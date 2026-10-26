#!/usr/bin/env python3
"""Materialize the Windows N-API addon, verified against npm's frozen lockfile."""
from pathlib import Path
import base64,hashlib,io,json,tarfile,urllib.request
root=Path(__file__).resolve().parent.parent;desktop=root/'desktop';name='@koromix/koffi-win32-x64'
entry=json.loads((desktop/'package-lock.json').read_text())['packages']['node_modules/'+name]
algorithm,expected=entry['integrity'].split('-',1);cache=root/'.cache/downloads';cache.mkdir(parents=True,exist_ok=True);archive=cache/('koffi-win32-x64-'+entry['version']+'.tgz')
if not archive.exists():
 with urllib.request.urlopen(entry['resolved'],timeout=60) as response:archive.write_bytes(response.read())
blob=archive.read_bytes()
if base64.b64encode(hashlib.new(algorithm,blob).digest()).decode()!=expected:raise SystemExit('Koffi Windows archive integrity verification failed.')
destination=desktop/'node_modules'/name;destination.mkdir(parents=True,exist_ok=True)
with tarfile.open(fileobj=io.BytesIO(blob),mode='r:gz') as tar:
 for member in tar.getmembers():
  if not member.name.startswith('package/'):raise SystemExit('Unexpected archive path.')
  target=destination/member.name[len('package/'):]
  if not target.resolve().is_relative_to(destination.resolve()):raise SystemExit('Unsafe archive path.')
  if member.isdir():target.mkdir(parents=True,exist_ok=True)
  elif member.isfile():target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(tar.extractfile(member).read());target.chmod(member.mode&0o777)
  else:raise SystemExit('Unsupported archive entry.')
print('Verified Windows Koffi '+entry['version']+' addon prepared.')
