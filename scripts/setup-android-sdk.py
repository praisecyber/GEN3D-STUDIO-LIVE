#!/usr/bin/env python3
"""Install the pinned Android compile tools from Google with archive verification."""
import hashlib
import os
from pathlib import Path
import urllib.request
import zipfile

root = Path(os.environ.get('ANDROID_SDK_ROOT', '/workspace/.android-sdk'))
archives = [
    ('platform-35_r02.zip', '0bb560a90a7a2cbd0dd8348224d518b638fe7949', 'platforms/android-35', 'android.jar'),
    ('build-tools_r35_linux.zip', '2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc', 'build-tools/35.0.0', 'apksigner'),
]
for filename, checksum, directory, marker in archives:
    destination = root / directory
    if (destination / marker).exists():
        continue
    archive = root / 'downloads' / filename
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        urllib.request.urlretrieve('https://dl.google.com/android/repository/' + filename, archive)
    if hashlib.sha1(archive.read_bytes()).hexdigest() != checksum:
        raise RuntimeError('Android SDK archive checksum mismatch: ' + filename)
    destination.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as bundle:
        prefixes = {item.split('/')[0] for item in bundle.namelist()}
        if len(prefixes) != 1:
            raise RuntimeError('Unexpected SDK archive layout')
        prefix = next(iter(prefixes)) + '/'
        for item in bundle.infolist():
            relative = item.filename[len(prefix):]
            if not relative:
                continue
            output = destination / relative
            if not output.resolve().is_relative_to(destination.resolve()):
                raise RuntimeError('Invalid SDK archive path')
            if item.is_dir():
                output.mkdir(parents=True, exist_ok=True)
            else:
                output.parent.mkdir(parents=True, exist_ok=True)
                output.write_bytes(bundle.read(item))
                output.chmod((item.external_attr >> 16) & 0o777 or 0o644)
    print('Verified Android SDK:', directory)
