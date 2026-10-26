#!/usr/bin/env python3
"""Create local Android signing material without printing passwords or replacing keys."""
import os,secrets,subprocess
from pathlib import Path
root=Path('/workspace/.android/gen3d-release');root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
key=root/'signing.p12';password=root/'password.txt'
if key.exists() or password.exists():
    if not key.is_file() or not password.is_file():raise SystemExit('Incomplete signing material; resolve it without overwriting existing keys.')
    print('Existing release signing material retained.');raise SystemExit(0)
fd=os.open(password,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as stream:stream.write(secrets.token_urlsafe(48)+'\n')
try:
    subprocess.run(['keytool','-genkeypair','-keystore',str(key),'-storetype','PKCS12','-alias','gen3drelease','-storepass:file',str(password),'-keypass:file',str(password),'-dname','CN=GEN3D Studio Live','-keyalg','RSA','-keysize','4096','-sigalg','SHA256withRSA','-validity','10000'],check=True,capture_output=True)
    key.chmod(0o600)
except subprocess.CalledProcessError:
    if not key.exists():password.unlink()
    raise SystemExit('Signing key generation failed; no credentials were printed.')
print('Release signing material created outside the checkout. Preserve it securely for future updates.')
