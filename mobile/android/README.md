# GEN3D Remote — Android development build

A native Android WebView application for the desktop's PIN-authenticated projection/production remote. It contains the KJV corpus for offline reading and a packaged offline viewer for saved desktop data. It exposes no JavaScript-to-native interface and does not grant file/content access or camera/microphone permissions to web pages.

Connected mode opens the entered desktop HTTP(S) origin. Offline mode opens packaged assets, so it does not require cross-origin file-to-network access. To retain desktop data, choose **Save current data offline** in the connected remote, then the native **Offline library & KJV Bible** button. Only the address and explicit offline snapshot are retained; PINs/passwords are not stored.

Build on Linux with Java 21/Python 3:

```bash
python3 scripts/setup-android-sdk.py
mobile/android/build.sh
```

The SDK helper downloads pinned Google Platform 35/Build Tools 35 archives and verifies their published checksums. `ANDROID_SDK_ROOT` overrides the SDK location. The build uses `java com.sun.tools.javac.Main`, D8, AAPT2, zipalign and apksigner; Gradle and an Expo account are not required.

Output: `build/GEN3D-Remote-debug.apk` (version 0.10.0, minimum Android 7). The development keystore remains outside the checkout at `/workspace/.android/gen3d-debug.keystore`. V2/V3 signatures are verified by the build. This is not a Play Store release or proof of physical-device compatibility. Use an updated Android System WebView.

Release signing is available with `GEN3D_ANDROID_BUILD_TYPE=release bash mobile/android/build.sh`. Supply your existing keystore and password-file paths with `GEN3D_ANDROID_KEYSTORE`, `GEN3D_ANDROID_PASSWORD_FILE`, and optionally `GEN3D_ANDROID_KEY_ALIAS`. To create a new local signing identity, run `python3 scripts/create-android-release-key.py` once. Existing keys are never replaced. Signing material is stored outside the checkout in `/workspace/.android/gen3d-release`, with a private directory and 0600 files. Preserve that directory securely: future updates require the same signing key. Passwords are passed by file, never printed or placed in command arguments.

Output: `build/GEN3D-Remote-release.apk`. Release signing is distinct from publishing to Play Store or physical-device acceptance. A release-signed APK cannot update an installed debug-signed APK; uninstalling the debug app removes its local data.
