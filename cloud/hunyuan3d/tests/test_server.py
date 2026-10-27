import base64
import io
import json
from pathlib import Path
import struct
import sys
import tempfile
import threading
import time
import unittest
from fastapi.testclient import TestClient
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import create_app
TOKEN = 'fixture-only-test-token-32-characters'

class Engine:
    model = 'synthetic fixture, not Hunyuan inference'
    def __init__(self):
        self.started = threading.Event()
        self.release = threading.Event()
        self.seen = []
    def ready(self):
        return True
    def generate(self, spec, directory, stage, cancelled):
        self.seen.append(spec)
        self.started.set()
        self.release.wait(2)
        if spec['prompt'] == 'FAIL':
            raise RuntimeError('do not return this private detail')
        if cancelled():
            return None
        if spec['mode'] == 'image':
            with Image.open(directory / 'input.png') as image:
                assert image.size == (32, 32)
        stage('exporting')
        text = json.dumps({'asset': {'version': '2.0'}, 'meshes': [{}]}).encode()
        text += b' ' * (-len(text) % 4)
        path = directory / 'model.glb'
        path.write_bytes(struct.pack('<III', 0x46546c67, 2, len(text) + 20) + struct.pack('<II', len(text), 0x4e4f534a) + text)
        return path

class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.engine = Engine()
        self.client = TestClient(create_app(self.engine, TOKEN, self.directory.name, 'GEN3D synthetic test provider', ttl=0.05))
        self.client.__enter__()
        self.headers = {'Authorization': 'Bearer ' + TOKEN}
    def tearDown(self):
        self.engine.release.set()
        self.client.__exit__(None, None, None)
        self.directory.cleanup()
    def submit(self, **extra):
        return self.client.post('/v1/jobs', headers=self.headers, json={'mode': 'text', 'prompt': 'robot', 'seed': 0, 'steps': 30} | extra)
    def wait(self, key, wanted):
        for _ in range(100):
            response = self.client.get('/v1/jobs/' + key, headers=self.headers)
            if response.json().get('status') == wanted:
                return response
            time.sleep(0.005)
        self.fail('Job did not reach ' + wanted)
    def test_authentication_and_no_secret_or_paths_in_health(self):
        self.assertEqual(self.client.get('/v1/health').status_code, 401)
        response = self.client.get('/v1/health', headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['ready'])
        self.assertNotIn(TOKEN, response.text)
        self.assertNotIn(self.directory.name, response.text)
    def test_text_download_delete_and_input_validation(self):
        for bad in [{'steps': 100}, {'seed': -1}, {'mode': 'image', 'image': 'not base64'}, {'prompt': ''}]:
            self.assertEqual(self.submit(**bad).status_code, 422)
        response = self.submit()
        self.assertEqual(response.status_code, 202)
        key = response.json()['id']
        self.engine.release.set()
        self.wait(key, 'completed')
        self.assertEqual(self.client.get('/v1/jobs/' + key + '/model', headers=self.headers).content[:4], b'glTF')
        self.client.delete('/v1/jobs/' + key, headers=self.headers)
        self.assertFalse((Path(self.directory.name) / key).exists())
    def test_image_is_validated_and_normalized(self):
        data = io.BytesIO()
        Image.new('RGB', (32, 32), 'orange').save(data, format='PNG')
        response = self.submit(mode='image', prompt='', image=base64.b64encode(data.getvalue()).decode())
        self.engine.release.set()
        self.wait(response.json()['id'], 'completed')
        self.assertNotIn('image', self.engine.seen[0])
    def test_single_gpu_queue_is_bounded_and_cancelled_jobs_never_download(self):
        key = self.submit().json()['id']
        self.assertTrue(self.engine.started.wait(1))
        queued = [self.submit().json()['id'] for _ in range(2)]
        self.assertEqual(self.submit().status_code, 429)
        for item in [key] + queued:
            self.client.delete('/v1/jobs/' + item, headers=self.headers)
        self.engine.release.set()
        self.wait(key, 'cancelled')
        self.assertEqual(self.client.get('/v1/jobs/' + key + '/model', headers=self.headers).status_code, 409)
    def test_cancelled_queue_entries_do_not_overflow_the_worker(self):
        active = self.submit().json()['id']
        self.assertTrue(self.engine.started.wait(1))
        for _ in range(2):
            key = self.submit().json()['id']
            self.client.delete('/v1/jobs/' + key, headers=self.headers)
        self.assertEqual(self.submit().status_code, 202)
        self.assertEqual(self.submit().status_code, 429)
        self.engine.release.set()
        self.wait(active, 'completed')

    def test_errors_are_generic_and_terminal_jobs_expire(self):
        key = self.submit(prompt='FAIL').json()['id']
        self.engine.release.set()
        response = self.wait(key, 'failed')
        self.assertNotIn('private detail', response.text)
        time.sleep(0.08)
        self.assertEqual(self.client.get('/v1/jobs/' + key, headers=self.headers).status_code, 404)

if __name__ == '__main__':
    unittest.main()
