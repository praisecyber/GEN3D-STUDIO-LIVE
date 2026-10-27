# Latest: 0.11.0 Online 3D Studio development preview

The 0.11.0 desktop adds the official Hunyuan3D-2mini Kaggle adapter, composed text-to-reference-to-mesh workflow, image-to-mesh workflow, authenticated jobs, cancellation, GLB validation/storage/export and native review before projection. Model weights are not included. The full 77-test JavaScript suite, projection UI regression, native online-3D integration and six Python service tests passed locally. Python service tests used the pinned FastAPI/Uvicorn/Pillow versions in an isolated environment. Tests use synthetic inference, not generated Hunyuan output.

Actual GPU inference and the complete Kaggle dependency/model-download/tunnel workflow are unverified: this workspace has neither CUDA nor a connected Kaggle account. Texture generation, automatic rigging and singing are not provided. Kaggle sessions and free-GPU quotas are temporary/provider-controlled. See [setup and limits](HUNYUAN3D-ONLINE.md), the supplied notebook and [0.11.0 release notes](releases/0.11.0.md). Windows build results and hashes for downloadable releases are supplied by GitHub Actions/release assets; the earlier artifact manifest is historical.

The earlier validation matrix below remains the 0.10.x baseline and does not establish physical acceptance for 0.11.0.

# GEN3D 0.10.1 desktop development-build evidence

GEN3D is an independently implemented development preview. This document distinguishes implemented workflows, executed checks and remaining acceptance work. It does not assert complete Holyrics parity or production certification.

## Outputs

- Windows x64 NSIS installer: `desktop/release/GEN3D Studio Live Setup 0.10.1.exe`. Includes FFmpeg/FFprobe and the Windows Koffi addon. The native PowerPoint helper is an external resource, accessible outside ASAR. No Windows publisher certificate is supplied.
- Android: `mobile/android/build/GEN3D-Remote-release.apk` and `GEN3D-Remote-debug.apk`, package `com.gen3d.remote`, version 0.10.0/code 10, minimum API 24/target API 35. Release uses a separate RSA-4096 signing identity outside the checkout. Preserve that identity securely for updates. Release signing is not Play Store publication or physical-device acceptance.
- Final sizes/hashes are recorded in `BUILD-ARTIFACTS.json` after packaging. Generated binaries, caches and signing material are excluded from Git.

## Implemented and exercised

| Area | Evidence | Limit |
| --- | --- | --- |
| Core validation | 73 unit tests passed | Does not establish hardware compatibility |
| Projection | Browser UI checks: KJV, XML modules, comparisons/favorites, songs/themes/groups, services/team/history/reports, translation review, reflow, automatic slides, exports and persistence | Translation test uses a local fixture service |
| Production | Native Electron browser/network inputs, linked audio, two ISO recordings decoded by FFprobe, actual Program WebRTC reception and remote switching | Synthetic inputs; physical capture cards and prolonged load remain untested |
| Transport | Real loopback HTTP, SRT and RTMP pulls; two RTMP publishing receivers and an isolated failed destination | Public destinations and RTMPS account acceptance need configured accounts |
| NDI | Real NDI SDK sender discovery, captured video/stereo audio, H.264/AAC decode and non-silent waveform, native switcher pixels/audio channel, removal and decoder cleanup | Requires a separately installed NDI 6 runtime; Windows and multi-machine LAN acceptance remain unrun |
| Holyrics import | Challenge/hash authentication checked by a real local HTTP fixture; song list/detail reads, order/repetitions, credits, duplicate preservation, review/apply, token clearance and output-window access rejection | Based on a public client reference, not certified against a running Holyrics installation |
| PowerPoint | Actual LibreOffice/Poppler conversion of a reordered 4:3 PPTX with embedded imagery; dimensions/colors/picture pixels, native Preview/Take/Clear, stage text and persistence verified | Static slides. Windows PowerPoint COM adapter is implemented but unrun on Windows |
| Stage | Independent windows/layouts, trusted operator controls, output-window access rejection, restart persistence and close tested in Electron | Up to eight windows; physical monitor assignment needs acceptance; cues are shared |
| Presenter/export | Actual GLB loading and projector vocals; WebM background composition, text changes, cancellation, 1080p avatar pixels and decoded Opus vocal waveform. Avatar export reads the rendered framebuffer directly, with repeated and full-sequence regression passes | Recorded vocals; no generated singing/phoneme synthesis. Real-time export speed depends on rendering throughput |
| Phone | Browser-width PIN controls, authenticated song sharing, rate limiting and offline refusal | Browser test is separate from Android device acceptance |
| Android packaging | Release/debug signatures, manifest and packaged assets checked; release APK installed/launched on API 35 emulator | Full Android workflow did not pass; see below |
| Android renderer recovery | Instrumentation passed: host activity survived renderer termination, unsafe controls disabled, Reload recreated the remote view | Does not validate a functioning WebView provider or live preview on hardware |

Run desktop native suites sequentially. They share port 8787. Run NSIS compression separately from real-time capture tests: a prior concurrent run failed the ISO frame-count assertion; quiet reruns passed the unchanged assertion.

## Android environment failure

The API 35 software emulator boots and installs the APK, but its WebView renderer crashes. A separate minimal app loading a blank page also failed (`stock_webview=stock renderer crashed`). GEN3D's full workflow instrumentation failed with a callback timeout/process crash before acceptance. These failures are not counted as passes or silently skipped.

GEN3D now handles renderer termination on API 26+ with a native recovery panel, preserves saved offline data and provides Reload. That path passed on the same emulator. Re-run the full workflow on a working hardware-accelerated emulator or physical Android device with an updated WebView. Reproducible instrumentation sources and a dummy local server are in `mobile/android/tests`.

## Runtime and integration requirements

- **NDI:** install a compatible, licensed NDI 6 runtime. Automatic discovery includes local sources; optional IPv4 discovery addresses help without multicast discovery. Runtime selection is session-only. Video format/resolution changes or loss of connection can end an input; refresh/re-add it. The runtime is not included in the installer. Cloud tests use a checksum-verified runtime outside the checkout, with vendor notices retained. No modification to Electron's external-buffer protections is needed: frames are copied into managed buffers in a separate helper process.
- **Holyrics:** enable API Server and grant read access for authentication, GetSongs and GetLyrics, or import a UTF-8 GetSongs JSON response. Tokens remain in the current session and are not written to project backups. Unsupported styled-only/blank slides are reported and excluded for review. Source groups can populate library filters for new songs after review; existing local assignments survive and unsupported names are reported. Original source groups are retained as metadata. Binary backups, private cloud accounts, saved source themes and linked media are not migrated.
- **PowerPoint:** Windows needs installed Microsoft PowerPoint; the helper refuses to attach while PowerPoint is already running, disables document macros and exports static slides. Linux needs LibreOffice/Poppler. Original deck/PNG files live in local app data; project backups reference those files and do not embed them. Animations/transitions are not imported.
- **OBS Virtual Camera:** needs installed OBS/driver/WebSocket. RPC logic and Program receiver media are tested separately; actual driver use in Zoom/Meet is unrun.
- **Licensed modules/providers:** NKJV is not bundled. Import appropriately licensed Bible modules. Translation and WebDAV backup require configured endpoints; live provider behavior is not established by fixtures.

## Remaining acceptance

1. Windows install/uninstall, capture devices/audio permissions, actual projectors/stage monitors, physical NDI senders, native PowerPoint and OBS driver sessions on Windows 11 x64.
2. Full Android connection/offline/Bible/preview/reconnect tests on a working device/provider; Wi-Fi/firewall behavior.
3. Real Holyrics API compatibility and representative native backup fixtures before claiming broader migration support.
4. Configured external streaming/provider accounts and publisher signing credentials. No public broadcast, GitHub release or app-store publication was performed.
5. Full PowerPoint animation playback, generated singing/phoneme alignment and prolonged hardware performance validation remain outside the verified implementation.

See `PROJECTION-FEATURE-COVERAGE.md` and `OUTPUT-WORKFLOWS.md` for supported workflows. Saving cloud configuration does not apply settings, publish the environment or prove restoration in a new task.

The 0.10.0 baseline verification completed after a frozen `npm ci`: 71 unit tests, projection UI, phone sharing, native production/presenter, PowerPoint, stage, export, NDI, Holyrics protocol/native UI and transport suites passed. Android release/debug and instrumentation APK builds/signature checks completed separately. The full Android workflow failure above remains an acceptance blocker and is not included in those passing desktop results.

Desktop 0.10.1 adds reviewed Holyrics group migration with opt-out, duplicate/local-assignment preservation and transactional storage rollback. The 73-unit suite, extended native Holyrics UI test and broad projection UI regression passed after this patch; other desktop suites in the matrix passed on 0.10.0. Android binaries remain version 0.10.0 and were unchanged by this desktop-only patch.

Current 0.10.1 regression rerun: all nine requested automated suites passed (73 unit tests; projection UI; native production/presenter; stage; static PowerPoint; NDI; phone; Holyrics; network transports). Initial graphical launch failures were caused by the missing virtual display and were rerun after starting Xvfb. The projection persistence test now waits for asynchronous Bible-favorite initialization before asserting its saved count. Production code and installer binaries were unchanged; all three artifact checksums were reverified. Exact results, initial attempts and log paths are in `CURRENT-VALIDATION.json`. Physical acceptance remains blocked; see `DEVICE-ACCEPTANCE.md`.
