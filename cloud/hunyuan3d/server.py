"""Private single-GPU job service. No model code, credentials or file paths are returned."""
import base64
import hmac
import io
import json
import os
import queue
import shutil
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image, UnidentifiedImageError

MAX_BODY = 14 * 1024 * 1024
MAX_IMAGE = 10 * 1024 * 1024
MAX_MODEL = 100 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 16_000_000


def create_app(engine, token, root, provider, ttl=3600):
    if not isinstance(token, str) or len(token) < 32 or len(token) > 512 or any(x in token for x in '\r\n'):
        raise ValueError('Configure a 32–512 character GPU token through Kaggle Secrets.')
    if not isinstance(provider, str) or not provider.strip() or len(provider) > 200 or any(ord(c) < 32 for c in provider):
        raise ValueError('Configure the full legal name of the GPU service provider.')
    provider = provider.strip()
    root = Path(root)
    root.mkdir(parents=True, exist_ok=True)
    jobs, lock, work = {}, threading.RLock(), queue.Queue(maxsize=3)
    stopping = threading.Event()

    def cleanup():
        for key, job in list(jobs.items()):
            if job['status'] in ('completed', 'failed', 'cancelled') and time.monotonic() - job['updated'] > ttl:
                shutil.rmtree(root / key, ignore_errors=True)
                del jobs[key]

    def worker():
        while not stopping.is_set():
            try:
                key, spec = work.get(timeout=0.2)
            except queue.Empty:
                with lock:
                    cleanup()
                continue
            with lock:
                if key not in jobs or jobs[key]['status'] == 'cancelled':
                    work.task_done()
                    continue
                jobs[key]['status'] = 'running'
            def cancelled():
                with lock:
                    return stopping.is_set() or jobs[key]['cancel']
            def stage(value):
                with lock:
                    jobs[key]['stage'] = value
            try:
                target = engine.generate(spec, root / key, stage, cancelled)
                with lock:
                    if cancelled():
                        jobs[key]['status'] = 'cancelled'
                    elif target is None or Path(target).resolve() != (root / key / 'model.glb').resolve() or not Path(target).is_file() or not 24 <= Path(target).stat().st_size <= MAX_MODEL:
                        jobs[key]['status'] = 'failed'
                    else:
                        jobs[key]['status'] = 'completed'
            except Exception as error:
                print('GEN3D generation failed during', jobs[key].get('stage', 'initialization'), 'with', type(error).__name__, flush=True)
                # Errors may contain local paths or inputs. Expose only a fixed message.
                with lock:
                    jobs[key]['status'] = 'cancelled' if cancelled() else 'failed'
            finally:
                (root / key / 'input.png').unlink(missing_ok=True)
                with lock:
                    jobs[key]['updated'] = time.monotonic()
                    if jobs[key]['status'] != 'completed':
                        shutil.rmtree(root / key, ignore_errors=True)
                work.task_done()

    @asynccontextmanager
    async def lifespan(app):
        thread = threading.Thread(target=worker, daemon=True)
        thread.start()
        yield
        stopping.set()
        thread.join(timeout=2)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware('http')
    async def authenticate(request, call_next):
        auth = request.headers.get('authorization', '')
        if not hmac.compare_digest(auth.encode(), ('Bearer ' + token).encode()):
            return JSONResponse({'error': 'Authentication required'}, status_code=401)
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response

    def public(key):
        job = jobs.get(key)
        if not job:
            raise HTTPException(404, 'Job expired or not found')
        return {'id': key, 'status': job['status'], 'stage': job.get('stage', 'queued')}

    @app.get('/v1/health')
    def health():
        return {'service': 'gen3d-hunyuan', 'protocol': 1, 'ready': engine.ready(), 'model': engine.model, 'provider': provider, 'modes': ['text', 'image'], 'textured': False}

    @app.post('/v1/jobs', status_code=202)
    async def submit(request: Request):
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > MAX_BODY:
                raise HTTPException(413, 'Input exceeds the size limit')
            chunks.append(chunk)
        try:
            spec = json.loads(b''.join(chunks))
            if not isinstance(spec, dict) or spec.get('mode') not in ('text', 'image') or type(spec.get('seed')) is not int or not 0 <= spec['seed'] <= 2147483647 or type(spec.get('steps')) is not int or not 10 <= spec['steps'] <= 50:
                raise ValueError()
            prompt = spec.get('prompt', '')
            if not isinstance(prompt, str) or len(prompt) > 1000 or spec['mode'] == 'text' and not prompt.strip():
                raise ValueError()
            spec = {name: spec[name] for name in ('mode', 'seed', 'steps')} | {'prompt': prompt.strip()}
        except (ValueError, TypeError, KeyError):
            raise HTTPException(422, 'Invalid generation settings')
        image = None
        if spec['mode'] == 'image':
            try:
                payload = json.loads(b''.join(chunks)).get('image')
                if not isinstance(payload, str):
                    raise ValueError()
                raw = base64.b64decode(payload, validate=True)
                if len(raw) > MAX_IMAGE:
                    raise ValueError()
                with Image.open(io.BytesIO(raw)) as source:
                    if source.format not in ('PNG', 'JPEG') or source.width * source.height > 16_000_000:
                        raise ValueError()
                    source.load()
                    image = source.convert('RGBA')
                    image.thumbnail((1024, 1024))
            except (ValueError, TypeError, UnidentifiedImageError, OSError, Image.DecompressionBombError):
                raise HTTPException(422, 'Choose a PNG or JPEG image up to 10 MB and 16 megapixels')
        with lock:
            cleanup()
            if work.full() or sum(job['status'] not in ('completed', 'failed', 'cancelled') for job in jobs.values()) >= 3 or len(jobs) >= 100:
                if image:
                    image.close()
                raise HTTPException(429, 'GPU queue full')
            key = str(uuid.uuid4())
            (root / key).mkdir(mode=0o700)
            if image:
                image.save(root / key / 'input.png')
                image.close()
            jobs[key] = {'status': 'queued', 'stage': 'queued', 'cancel': False, 'updated': time.monotonic()}
            work.put_nowait((key, spec))
            return public(key)

    @app.get('/v1/jobs/{key}')
    def status(key: str):
        with lock:
            cleanup()
            return public(key)

    @app.delete('/v1/jobs/{key}')
    def cancel(key: str):
        with lock:
            public(key)
            jobs[key]['cancel'] = True
            if jobs[key]['status'] in ('queued', 'completed', 'failed'):
                jobs[key]['status'] = 'cancelled'
                jobs[key]['updated'] = time.monotonic()
                shutil.rmtree(root / key, ignore_errors=True)
            return public(key)

    @app.get('/v1/jobs/{key}/model')
    def model(key: str):
        with lock:
            public(key)
            if jobs[key]['status'] != 'completed':
                raise HTTPException(409, 'Model is not ready')
            return FileResponse(root / key / 'model.glb', media_type='model/gltf-binary', filename='GEN3D-Hunyuan.glb')

    return app


def main():
    import uvicorn
    from engine import HunyuanEngine
    engine = HunyuanEngine()
    if not engine.ready():
        raise SystemExit('Select a Kaggle CUDA GPU before starting this service.')
    app = create_app(engine, os.environ.get('GEN3D_GPU_TOKEN', ''), os.environ.get('GEN3D_JOB_DIR', '/kaggle/working/gen3d-jobs'), os.environ.get('GEN3D_PROVIDER_NAME', ''))
    uvicorn.run(app, host='127.0.0.1', port=7860, access_log=False)


if __name__ == '__main__':
    main()
