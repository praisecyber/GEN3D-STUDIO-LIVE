#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
sdk_root="${ANDROID_SDK_ROOT:-/workspace/.android-sdk}"
tools="$sdk_root/build-tools/35.0.0"
platform="$sdk_root/platforms/android-35/android.jar"
key="${GEN3D_ANDROID_KEYSTORE:-/workspace/.android/gen3d-release/signing.p12}"
password_file="${GEN3D_ANDROID_PASSWORD_FILE:-/workspace/.android/gen3d-release/password.txt}"
alias="${GEN3D_ANDROID_KEY_ALIAS:-gen3drelease}"
test -f "$key" && test -f "$password_file" || { echo 'Use the same keystore/password file as the installed release APK.' >&2; exit 1; }
mkdir -p build/classes build/dex
java com.sun.tools.javac.Main -source 8 -target 8 -classpath "$platform" -d build/classes ./*.java
"$tools/d8" --lib "$platform" --min-api 24 --output build/dex build/classes/com/gen3d/remote/tests/*.class
"$tools/aapt2" link -I "$platform" --manifest AndroidManifest.xml -o build/unsigned.apk
python3 - <<'PY'
from zipfile import ZipFile
with ZipFile('build/unsigned.apk','a') as archive:archive.write('build/dex/classes.dex','classes.dex')
PY
"$tools/zipalign" -f 4 build/unsigned.apk build/aligned.apk
"$tools/apksigner" sign --ks "$key" --ks-key-alias "$alias" --ks-pass "file:$password_file" --out build/GEN3D-Remote-tests.apk build/aligned.apk
"$tools/apksigner" verify build/GEN3D-Remote-tests.apk
