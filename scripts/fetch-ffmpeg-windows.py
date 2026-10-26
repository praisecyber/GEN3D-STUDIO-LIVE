#!/usr/bin/env python3
"""Fetch the pinned, checksum-verified Windows FFmpeg distribution for packaging."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import urllib.request
import zipfile

project = Path(__file__).resolve().parent.parent
name = 'ffmpeg-n8.1.3-23-g5c4f5744cd-win64-gpl-8.1.zip'
release = 'autobuild-2026-10-22-13-06'
checksum = '75f5d6b673be7d93f59dcffb81a92c003580a7dcdbff768976b7907869aee09a'
url = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/' + release + '/' + name
cache = Path(os.environ.get('GEN3D_DOWNLOAD_CACHE', project / '.cache' / 'downloads'))
cache.mkdir(parents=True, exist_ok=True)
archive = cache / name
if not archive.exists():
    urllib.request.urlretrieve(url, archive)
if hashlib.sha256(archive.read_bytes()).hexdigest() != checksum:
    raise RuntimeError('Windows FFmpeg archive checksum mismatch; refusing to package it')
destination = project / 'desktop' / 'vendor' / 'ffmpeg' / 'windows'
destination.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(archive) as bundle:
    prefixes = {item.split('/')[0] for item in bundle.namelist()}
    if len(prefixes) != 1:
        raise RuntimeError('Unexpected FFmpeg archive layout')
    prefix = next(iter(prefixes)) + '/'
    for source, output in [('bin/ffmpeg.exe', 'ffmpeg.exe'), ('bin/ffprobe.exe', 'ffprobe.exe'), ('LICENSE.txt', 'LICENSE.txt')]:
        (destination / output).write_bytes(bundle.read(prefix + source))
(destination / 'SOURCE.md').write_text(
    '# Windows FFmpeg component\n\n'
    'This separately executed FFmpeg distribution is licensed under GPL v3; see LICENSE.txt.\n\n'
    'Binary archive: ' + url + '\n\n'
    'Archive SHA-256: `' + checksum + '`\n\n'
    'Build recipes and dependency source locations: https://github.com/BtbN/FFmpeg-Builds/tree/' + release + '\n\n'
    'FFmpeg source revision: https://github.com/FFmpeg/FFmpeg/commit/5c4f5744cd\n'
)
print('Verified Windows FFmpeg and FFprobe prepared with their license and source references.')
