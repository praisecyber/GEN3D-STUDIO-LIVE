# Android instrumentation

These tests run inside Android against the release-signed APK. Build them with `bash mobile/android/tests/build.sh`, using the same signing identity as the installed app. They are test-only and are not bundled with GEN3D.

Start `node mobile/android/tests/server.cjs` with the desktop dependencies installed. Install the release APK, then `adb install -r -t mobile/android/tests/build/GEN3D-Remote-tests.apk`.

- Workflow: `adb shell am instrument -w com.gen3d.remote.tests/.AndroidWorkflowTest`. The emulator defaults to `http://10.0.2.2:9878`. For USB-connected devices, use `adb reverse tcp:9878 tcp:9878` and pass `-e desktop http://127.0.0.1:9878` before the component name. It checks offline KJV, PIN authentication, a remote command, Android snapshot transfer and disabled offline controls.
- Provider baseline: `adb shell am instrument -w com.gen3d.remote.tests/.WebViewProbeTest`. A minimal stock WebView should return `stock_webview=2`. A failure establishes that the WebView provider must be fixed before the workflow can be accepted.
- Renderer recovery (API 29+): `adb shell am instrument -w com.gen3d.remote.tests/.RecoveryTest`. It terminates the renderer, checks safe native recovery controls, and uses Reload to recreate the view.

In the current cloud software emulator, the APK installed and launched, but even the stock blank WebView crashed. The full workflow therefore failed and is not counted as passed. The native recovery path passed. Re-run workflow acceptance on a working emulator or physical device with an updated WebView. The server uses dummy test content and PIN 1234, not production credentials.
