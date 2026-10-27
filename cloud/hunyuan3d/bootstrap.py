"""Run in a Kaggle notebook after selecting GPU and enabling Internet.
Uses Kaggle's existing CUDA torch wheel. Does not launch a tunnel until health passes.
"""
import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.request
import json

UPSTREAM = 'f8db63096c8282cb27354314d896feba5ba6ff8a'
TUNNEL_URL = 'https://github.com/cloudflare/cloudflared/releases/download/2026.10.5/cloudflared-linux-amd64'
TUNNEL_SHA = 'e1bc0cf084fd9e590554fe769a86b1db46701c3f847a43d902f7b974a4e16298'


def start():
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError('Enable a Kaggle GPU accelerator, then restart the notebook.')
    # Name/status only: never print the token or put it in a command line.
    from kaggle_secrets import UserSecretsClient
    token = UserSecretsClient().get_secret('GEN3D_GPU_TOKEN')
    if not 32 <= len(token) <= 512 or any(c in token for c in '\r\n'):
        raise RuntimeError('Add GEN3D_GPU_TOKEN in Kaggle Secrets (32–512 characters).')
    provider = os.environ.get('GEN3D_PROVIDER_NAME', '').strip()
    if not provider or len(provider) > 200 or any(ord(c) < 32 for c in provider):
        raise RuntimeError('Enter the full legal name of the GPU service provider in the setup cell.')
    project = Path(__file__).resolve().parent
    working = Path('/kaggle/working')
    repository = working / 'Hunyuan3D-2'
    if not repository.exists():
        subprocess.run(['git', 'clone', '--no-checkout', 'https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git', str(repository)], check=True)
    subprocess.run(['git', '-C', str(repository), 'checkout', '--detach', UPSTREAM], check=True)
    if subprocess.check_output(['git', '-C', str(repository), 'rev-parse', 'HEAD'], text=True).strip() != UPSTREAM:
        raise RuntimeError('Upstream source revision mismatch')
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', str(project / 'requirements.txt')], check=True)
    subprocess.run([sys.executable, '-m', 'pip', 'install', '--no-deps', '--no-build-isolation', '-e', str(repository)], check=True)
    # Catch missing CPU libraries / incompatible CUDA wheels before exposing an endpoint.
    subprocess.run([sys.executable, '-c', 'import torch; from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline; from diffusers import AutoPipelineForText2Image; assert torch.cuda.is_available()'], check=True)
    binary = working / 'gen3d-cloudflared'
    if not binary.exists():
        urllib.request.urlretrieve(TUNNEL_URL, binary)
    if hashlib.sha256(binary.read_bytes()).hexdigest() != TUNNEL_SHA:
        raise RuntimeError('Cloudflare tunnel binary checksum mismatch')
    binary.chmod(0o700)
    env = os.environ.copy()
    env['GEN3D_GPU_TOKEN'] = token
    env['PYTHONPATH'] = str(repository) + os.pathsep + env.get('PYTHONPATH', '')
    log = (working / 'gen3d-gpu.log').open('w')
    server = subprocess.Popen([sys.executable, str(project / 'server.py')], env=env, stdout=log, stderr=subprocess.STDOUT)
    tunnel = None
    try:
        ready = False
        for _ in range(120):
            if server.poll() is not None:
                raise RuntimeError('Backend exited. Inspect /kaggle/working/gen3d-gpu.log for dependency errors.')
            try:
                request = urllib.request.Request('http://127.0.0.1:7860/v1/health', headers={'Authorization': 'Bearer ' + token})
                with urllib.request.urlopen(request, timeout=2) as response:
                    ready = json.load(response).get('ready') is True
                if ready:
                    break
            except (OSError, ValueError):
                pass
            time.sleep(1)
        if not ready:
            raise RuntimeError('GPU service did not become ready; no public tunnel was opened.')
        tunnel_log = working / 'gen3d-tunnel.log'
        with tunnel_log.open('w') as stream:
            tunnel = subprocess.Popen([str(binary), 'tunnel', '--url', 'http://127.0.0.1:7860', '--no-autoupdate'], stdout=stream, stderr=subprocess.STDOUT)
        for _ in range(90):
            if tunnel.poll() is not None:
                raise RuntimeError('Tunnel exited. Review the tunnel log and Kaggle network policy.')
            match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', tunnel_log.read_text())
            if match:
                print('GEN3D GPU URL:', match.group(0))
                print('In GEN3D, open Online 3D Studio. Enter this URL and the same token you stored in Kaggle Secrets.')
                print('Keep this cell running. Stop it to disconnect. First generation downloads several GB of weights.')
                break
            time.sleep(1)
        else:
            raise RuntimeError('No tunnel URL received. Check the tunnel log.')
        while server.poll() is None and tunnel.poll() is None:
            time.sleep(5)
        raise RuntimeError('The GPU server or tunnel stopped. Start the notebook again and reconnect.')
    finally:
        for process in (tunnel, server):
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
        log.close()


if __name__ == '__main__':
    start()
