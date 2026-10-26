# Third-party components

- The KJV data comes from `thiagobodruk/bible`, pinned at commit `92e121c2c829eae351b76db1d32858ced77b16a6`. The source checksum, conversion description and upstream MIT license are retained in `desktop/renderer/bibles/SOURCE.md` and `LICENSE.txt`. The APK carries the same notice/source information.
- Windows packaging prepares the BtbN FFmpeg 8.1 branch build `ffmpeg-n8.1.3-23-g5c4f5744cd-win64-gpl-8.1.zip` from release `autobuild-2026-10-22-13-06`, checked against SHA-256 `75f5d6b673be7d93f59dcffb81a92c003580a7dcdbff768976b7907869aee09a`. FFmpeg/FFprobe run as separate executables. Their GPL v3 license and source/build references accompany them in the installed `resources/ffmpeg` directory. The fetch script refuses checksum mismatches.
- Electron/Chromium notices and production npm dependencies retain their packaged licenses. `package-lock.json` pins the JavaScript build dependencies. OBS Studio and its virtual-camera driver are separate user-installed components; GEN3D talks to OBS WebSocket locally.
- Android SDK tools are build-time dependencies downloaded from Google with the checksums recorded in `scripts/setup-android-sdk.py`. They are not embedded in the APK.

GEN3D does not ship Holyrics, ProPresenter, EasyWorship or vMix code/assets, or licensed NKJV data. Native compatibility with their private formats/accounts is not implied.

NDI integration uses Koffi 3.3.3 (MIT; pinned in the npm lockfile) and declarations based on the MIT-licensed public NDI headers. Their notice is retained in NDI-PUBLIC-HEADER-LICENSE.txt. The proprietary NDI runtime is installed separately by the operator and is not bundled or linked into the FFmpeg executable. Cloud tests use runtime 6.3.2 from the checksum-verified ndi-python 6.3.2.6 wheel, retained outside the checkout with its vendor license notices. This is test tooling, not an app resource or an assertion that the SDK runtime is MIT-licensed.

Holyrics read-only import was independently implemented using the API/lyrics-model reference in `open-mission/holyrics-control-app/apps/server/docs/holyrics-api` (public GitHub source, inspected 2026-10-26). No client implementation code or Holyrics application assets are bundled. Protocol fixtures are independent test data and are not vendor certification.
