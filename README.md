# GEN3D Studio Live 0.8 — development preview

Download the Windows development installer from the [v0.11.0 development release](https://github.com/praisecyber/GEN3D-STUDIO-LIVE/releases/tag/v0.11.0). This unsigned preview still needs physical Windows/Android acceptance; see [release readiness](docs/RELEASE-READINESS.md).


An Electron/React desktop application combining church projection, live production, recording, streaming and a phone remote. Its implementation is independent of Holyrics, EasyWorship, ProPresenter, OBS and vMix. Complete compatibility with those applications is not claimed.

## Run the desktop app

Install Node.js LTS, then run from `desktop`:

```powershell
npm.cmd ci
npm.cmd start
```

The operator, projector and stage windows open together. With one monitor, the two output windows open as movable test windows. Projection and Program routing remain independent; switching workspace tabs does not take a source live.

The packaged Windows application includes checksum-verified FFmpeg/FFprobe with their license and source references under `resources/ffmpeg`. A Linux source checkout uses FFmpeg/FFprobe on PATH. **Channels and Master start muted.** Add sources, prepare Preview, unmute the desired audio, then Cut or Transition to Program.

## Projection Studio

- Song editing, search, paragraph/slide management, groups, history and service orders.
- JSON/text/OpenLyrics song import with review and duplicate-title protection; song-library backups.
- Complete bundled KJV: 66 books and 31,102 verses. Offline JSON, Zefania XML and OpenSong Bible modules; book/chapter/verse navigation, search, favorites and translation comparison.
- Dated services/events, weekly recurrence, team assignments, played/scheduled-song and member reports, and CSV export.
- Still/video backgrounds, saved themes, bold/italic/outline/shadow, text color, alignment, line spacing, margins and background dimming.
- Separate stage current/next text, clock, slide count, uppercase/color settings, messages and pauseable countdowns.
- Automatic slide shows; automatic song reflow; LibreTranslate-compatible translation preview and explicit apply.
- Offline HTML presentations and PNG-in-ZIP exports at 720p or 1080p. HTML exports can be printed to PDF. These exports include text/still backgrounds, not live video, audio or avatars.
- Animated orange Three.js presenter; self-contained GLB avatars; system speech reading; recorded vocal playback with amplitude-driven mouth animation. Custom mouth animation recognizes mouthOpen/jawOpen/viseme_AA morphs when present. This does not generate singing audio or phoneme-accurate lip synchronization.
- PowerPoint text import and static visual-deck import, local media and project backups. Project backups contain media/background **path references**, not the media files themselves. Keep source files in place or migrate them separately.
- Optional HTTPS/WebDAV project upload/download; credentials stay in the session. Cloud downloads do not replace the current project automatically.

The operator monitor uses a 2D presenter guide; the projector renders the 3D model. Recorded presenter vocals play on Projection output. Program has its separate audio mixer.

See [projection formats and coverage](docs/PROJECTION-FEATURE-COVERAGE.md).

## Live Production

Eight non-black source slots plus Black: cameras/USB capture, screens/windows, images/videos, isolated browser pages, and direct HTTP(S), RTMP/RTMPS or SRT media streams. Network input URLs are not webpage scrapers. Browser sources render at 15 fps, have no privileged bridge, deny permissions/popups and remain silent; protected playback may not work.

Preview/Program switching supports Cut, Fade, Wipe, Slide and Zoom; PiP, chroma/luma keying, lyrics, lower thirds and logo layers are composited into Program. Keyboard shortcuts in Live Production: **0–8** selects Preview; **Space** cuts; **Shift+Space** runs the selected transition. Shortcuts do not run while editing fields, using buttons or choosing capture sources.

Source audio feeds the mixer for network/video inputs. Cameras can optionally include the default microphone; choose a capture card's exposed audio device separately in Audio Mixer when needed. Linked channels can Follow Program with transition weighting. Master/channel mute and volume remain authoritative. The operator does not monitor the mixer on speakers.

Program recording saves switched video and Master audio as WebM. ISO recording saves each selected source to a separate WebM in a new folder, with a manifest. ISO audio is taken from its linked input channel before faders; removed sources become black/silent. ISO and Program recording can run independently. `.part` files are retained after interrupted or failed writes.

**Virtual Camera via OBS:** install OBS Studio, enable its WebSocket server on port 4455, and enter its password in GEN3D if required. GEN3D configures a managed browser source and starts OBS Virtual Camera. Select that device in Zoom/Meet; select meeting audio separately. The bridge refuses to change an OBS session that is already streaming, recording or using Virtual Camera. A standalone GEN3D webcam driver is not included.

Direct NDI discovery and video/stereo-audio reception are implemented using a separately installed NDI 6 runtime. Choose NDI sender in Network & browser inputs, refresh sources, or add IPv4 discovery addresses. The runtime is not bundled.

## Streaming

Publish Program to up to three RTMP/RTMPS destinations, independently of projector routing and local recording. Enter server URLs and stream keys in Streaming. Encoder availability and non-empty destination fields gate Start; the engine validates supported URLs and duplicates. Keys remain session-only.

The encoder targets 1280×720, 30 fps, H.264, AAC and two-second GOPs. `sending` means encoder output progress, not confirmation of an approved/public broadcast. Confirm actual publication in the destination dashboard. A failed destination is isolated from the remaining outputs.

## Phone remote and Android app

Open the address shown under **Phone browser** in Projection Studio on the same LAN and enter its PIN. The browser remote supports projection, service-order navigation, production switching, schedules/reports and WebRTC Program preview. Video preview starts muted; its audio controls are separate. Library selections require an explicit Take action.

The Android APK provides the same remote plus bundled offline KJV. Use **Save current data offline** in the connected remote, then the native **Offline library & KJV Bible** button; the offline copy is read-only. No desktop connection is required to read the bundled Bible. The app stores the last desktop address, not its PIN/password.

Build the development APK on Linux with Java 21 and Python 3:

```bash
python3 scripts/setup-android-sdk.py
mobile/android/build.sh
```

Outputs: `mobile/android/build/GEN3D-Remote-debug.apk` and a separately release-signed APK using the release build option. Neither is a Play Store publication. Android 7+ and an updated Android System WebView are required. Physical Android testing remains outstanding.

## Windows packaging

```bash
cd desktop
npm run package:win
```

This verifies/downloads the pinned Windows FFmpeg archive, builds the frontend and produces `desktop/release/GEN3D Studio Live Setup 0.11.0.exe`. The per-user installer/uninstaller uses NSIS and preserves application data. The installer is a development artifact without a publisher signing certificate. Windows installation and hardware acceptance remain outstanding.

Third-party binary/source notices are in `desktop/renderer/bibles/` and the prepared `desktop/vendor/ffmpeg/windows/` directory. Cached SDKs/vendor binaries and build artifacts are ignored by Git.

## Validation

From `desktop`:

```bash
npm run build
npm test
npm run test:ui
npm run test:native
npm run test:network
```

The UI suite uses `GEN3D_TEST_BROWSER` or `/usr/bin/chromium`. Native integration checks use Electron and require an active display (cloud setup supplies Xvfb). Do not run two native suites concurrently: the application owns local port 8787. The code uses localhost for internal validation; no cloud web preview is published.

Validation evidence and remaining limitations: [release readiness](docs/RELEASE-READINESS.md).

Phone song sharing: open the remote on the same network, connect with the desktop PIN, expand **Send a song to the desktop**, and enter a title and lyrics separated by blank lines. The operator reviews **Songs received from phones** before adding them. Pending transfers are temporary and never appear live automatically. Run `npm run test:phone` in `desktop` to verify this workflow.

Version 0.9 adds **Independent stage displays** in Projection Studio (up to eight monitor/window layouts with saved widget positions, colors and visibility) and **Timed WebM video** in Export presentation (moving backgrounds, optional avatar and chosen recorded vocals). Use `npm run test:stages` and `npm run test:export` for the new integration checks. Stage-window layouts are machine settings, separate from project backups.

See [stage and video output instructions](docs/OUTPUT-WORKFLOWS.md) for monitor assignment, per-widget layout controls, and exporting an avatar with recorded vocals.

Version 0.10 adds **Import PowerPoint visuals** beside text import. Visual decks preserve static slide layout and pictures, appear in Media, and support Preview/Take and stage notes. Windows requires installed PowerPoint; Linux requires LibreOffice/Poppler. Animation and transition playback are not imported. Android release-signed builds are supported; see [Android build instructions](mobile/android/README.md).

**Holyrics migration:** expand Import from Holyrics in Projection Studio. Read from its API Server using a read token or choose GetSongs JSON. Review before adding. Basic text, repeated slide order, credits and source notes are retained; local matching titles are kept. Unsupported content is reported. See [Holyrics import protocol and limits](docs/HOLYRICS-IMPORT.md).

Run `npm run test:holyrics` for the local protocol/native UI check. Run `GEN3D_NDI_LIBRARY=/path/to/installed/runtime DISPLAY=:99 npm run test:ndi` for real loopback NDI integration on Linux; Windows uses the same variable with its DLL path. Neither check establishes compatibility with every physical sender or vendor deployment.

## Online 3D Studio

Generate untextured GLB meshes through official Hunyuan3D-2mini on your Kaggle GPU. Text prompts first create an SDXL-Turbo reference image. Download the supplied [Kaggle notebook](cloud/hunyuan3d/GEN3D-Kaggle.ipynb) and follow the [setup guide](docs/HUNYUAN3D-ONLINE.md). GPU inference on Kaggle remains unverified; automated integration checks use synthetic fixtures. Kaggle quotas and temporary sessions apply.
