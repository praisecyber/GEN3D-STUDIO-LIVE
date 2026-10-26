#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
build_type="${GEN3D_ANDROID_BUILD_TYPE:-debug}"
if [[ "$build_type" != debug && "$build_type" != release ]]; then echo "Build type must be debug or release." >&2; exit 1; fi
sdk_root="${ANDROID_SDK_ROOT:-/workspace/.android-sdk}"
build_tools="$sdk_root/build-tools/35.0.0"
platform_jar="$sdk_root/platforms/android-35/android.jar"
for tool in aapt2 d8 zipalign apksigner; do test -x "$build_tools/$tool" || { echo "Missing Android SDK Build Tools 35.0.0: $tool" >&2; exit 1; }; done
test -f "$platform_jar" || { echo 'Missing Android SDK Platform 35' >&2; exit 1; }
rm -rf build/classes build/dex build/assets
mkdir -p build/classes build/dex build/assets /workspace/.android
python3 - <<'PY'
from pathlib import Path
import shutil
renderer=Path("../../desktop/renderer")
assets=Path("build/assets")
for name in ["remote-client.js","program-client.js","remote.css","projection-library.js"]:
    shutil.copyfile(renderer/name,assets/name)
shutil.copyfile(renderer/"bibles/kjv.js",assets/"kjv.js")
shutil.copyfile(renderer/"bibles/LICENSE.txt",assets/"KJV-LICENSE.txt")
shutil.copyfile(renderer/"bibles/SOURCE.md",assets/"KJV-SOURCE.md")
html=(renderer/"remote.html").read_text().replace('href="/remote.css"','href="remote.css"').replace('src="/program-client.js"','src="program-client.js"').replace('src="/remote-client.js"','src="remote-client.js"')
html=html.replace("</body>",'<script src="projection-library.js"></script><script src="kjv.js"></script><script src="offline-bible.js"></script></body>')
(assets/"remote.html").write_text(html)
shutil.copyfile(Path("offline-bible.js"),assets/"offline-bible.js")
PY
java com.sun.tools.javac.Main -source 8 -target 8 -bootclasspath "$platform_jar" -d build/classes src/com/gen3d/remote/MainActivity.java
"$build_tools/d8" --lib "$platform_jar" --min-api 24 --output build/dex build/classes/com/gen3d/remote/*.class
"$build_tools/aapt2" link -I "$platform_jar" --manifest AndroidManifest.xml -A build/assets --min-sdk-version 24 --target-sdk-version 35 -o build/unsigned.apk
python3 - <<'PY'
from zipfile import ZipFile,ZIP_DEFLATED
with ZipFile('build/unsigned.apk','a',ZIP_DEFLATED) as archive:
    archive.write('build/dex/classes.dex','classes.dex')
PY
"$build_tools/zipalign" -f 4 build/unsigned.apk build/aligned.apk
if [[ "$build_type" == release ]]; then
  signing_key="${GEN3D_ANDROID_KEYSTORE:-/workspace/.android/gen3d-release/signing.p12}"
  signing_password_file="${GEN3D_ANDROID_PASSWORD_FILE:-/workspace/.android/gen3d-release/password.txt}"
  signing_alias="${GEN3D_ANDROID_KEY_ALIAS:-gen3drelease}"
  test -f "$signing_key" && test -f "$signing_password_file" || { echo 'Release keystore/password file missing. Supply existing signing files or run scripts/create-android-release-key.py.' >&2; exit 1; }
  "$build_tools/apksigner" sign --ks "$signing_key" --ks-key-alias "$signing_alias" --ks-pass "file:$signing_password_file" --out build/GEN3D-Remote-release.apk build/aligned.apk
  "$build_tools/apksigner" verify --verbose build/GEN3D-Remote-release.apk
else
  debug_keystore=/workspace/.android/gen3d-debug.keystore
  if ! test -f "$debug_keystore"; then
    keytool -genkeypair -keystore "$debug_keystore" -alias androiddebugkey -storepass android -keypass android -dname 'CN=Android Debug,O=Android,C=US' -keyalg RSA -keysize 2048 -validity 10000
  fi
  "$build_tools/apksigner" sign --ks "$debug_keystore" --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out build/GEN3D-Remote-debug.apk build/aligned.apk
  "$build_tools/apksigner" verify --verbose build/GEN3D-Remote-debug.apk
fi
