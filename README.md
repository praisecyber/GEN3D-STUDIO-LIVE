# GEN3D STUDIO LIVE v17 — Picture-in-Picture & Chroma/Luma Keying

This update adds picture-in-picture and chroma/luma keying to the existing Electron + React production, audio, recording and multi-RTMP workflows. It is runnable source code, not a Windows installer.

## Run on Windows

Install Node.js LTS with npm, extract the ZIP, and open PowerShell in `gen3d-work\desktop`:

```powershell
npm.cmd ci
npm.cmd start
```

Using `npm.cmd` also avoids PowerShell's npm.ps1 execution-policy issue. The first install needs internet access to obtain dependencies and Electron. The start command builds React locally, then opens the desktop application. React does not load from a CDN. If you edit source code, restart the app to rebuild.

The app opens an operator window, a main output window, and a stage window. With a second display, main output uses it; with a third display, stage uses that display. With one display, output and stage open as test windows. Move those aside to access the operator. Start in Projection Studio; switch to the Live Production tab to use the new video switcher.

## Try Live Production without a camera

1. Click **+ Test pattern** twice.
2. Click the first pattern's tile to load Preview.
3. Click **CUT** to move it to Program. Previous Program becomes Preview.
4. Select the second pattern, choose a fade duration, and click **FADE**.
5. Click **Send Program to projector** to route Program to the main output window.
6. Use **Projection output** or **Send Projection to projector** to return to lyrics/Bible output.

Selecting inputs or switching workspace tabs never changes the projector routing automatically. Black is always available as a source. The stage window continues showing the projection service information, independently of production video.

## Camera workflow

- Connect a webcam or a compatible USB video capture device.
- Click **Enable / refresh** to grant camera access and refresh the device list.
- Select a camera and click **+ Add camera**. Click its tile to Preview it, then Cut or Fade.
- Eight combined camera, screen, image, video and test-pattern input slots are available in addition to Black. Eight slots do not guarantee that a particular PC or USB bus can run eight cameras simultaneously.
- A physical HDMI camera needs a compatible capture device that appears to Windows as a camera. Direct Blackmagic SDK, NDI, SRT, RTMP and browser-source inputs are not implemented.
- Camera inputs request video only. Add microphones or the capture device’s exposed audio input separately in the Audio Mixer; audio mixes independently of camera selection.
- Remove a source with its × button to stop its camera tracks. Affected Preview/Program monitors return to Black; transitions involving that source are canceled.
- If Windows denies camera access, enable Camera access and access for desktop apps in Windows Settings. Close other software if it has exclusive use of the device.

## Screen and media inputs

- In Live Production, click **+ Screen / window**. Choose a thumbnail from the native capture-source list. The app requests video-only capture for that screen or window, then adds it to the input deck. Preview it and use Cut/Fade as with a camera. Capture starts only after selecting a source, not when opening the picker. Cancel leaves the deck unchanged.
- Remove a capture input with × to stop its video tracks. If the capture track ends, the source is removed and affected source selections return to Black. Existing Program overlays remain visible over that black background until hidden.
- Click **+ Video / image** to import local PNG/JPEG/WebP/GIF images or MP4/WebM/MOV video files. Actual video codec support depends on Electron; an extension alone does not guarantee playback.
- Images and videos preserve their aspect ratio with black letterboxing. Videos load paused on their first frame. Use the source tile’s Play/Pause, Restart and Loop controls. Cut/Fade does not automatically start or stop a video; a playing video continues in the background until paused, ended or removed.
- Screen capture and visual video inputs are silent in this release. They do not capture desktop/system sound or route an imported video’s embedded audio into the mixer. Use the Audio Mixer’s microphones and separate audio files for the Program mix.
- Files remain local path references. Moving a source file can break playback. Removing a video releases its player. These inputs are session-only and are not included in projection project exports.

The capture picker uses Electron’s `desktopCapturer` list and `setDisplayMediaRequestHandler` with an explicit operator-selected source. The selection expires after ten seconds and is restricted to the operator’s main frame. No browser website URL or remote stream is scraped by this feature. Native Windows permissions and physical capture behavior require Windows testing.

## Picture-in-picture and chroma/luma keying

In Live Production, open **Picture-in-picture & keyer** after adding your desired inputs. The ordinary switcher Program is the background for this composition.

- For PiP, choose an inset source, select one of four corners, set its width from 15–50% of Program, and enable **Show picture-in-picture**. The inset uses a 16:9 box with the input’s existing aspect-ratio fit and black letterboxing.
- For a green-screen presenter, take the intended background source to Program. Select the presenter camera/video as **Foreground source**, choose Chroma, set the key color and enable the keyer. Adjust color tolerance, edge softness and spill suppression while viewing Program. Selecting the same input as foreground and background will reveal that same background behind the cutout.
- For luma keying, choose Luma and set a brightness threshold. Bright areas are removed by default; **Remove dark instead of bright** reverses that behavior. Edge softness affects the transition around the threshold.
- **Hide PiP & keyer** disables both layers while keeping their controls ready for reuse. Removing an input disables and clears any PiP/keyer selection using it.

Composition order is: switched/faded Program background, keyed foreground, PiP inset, then lyrics/lower thirds/logo. Background Cut/Fade affects the background bus; foreground and PiP selections stay fixed until changed. Preview and source thumbnails remain clean. Audio continues to use the independent mixer and does not follow these layer selections.

The keyer processes a 640 × 360 CPU canvas and scales its result into the 1280 × 720 Program output. It is a basic keyer, without advanced matte/hair refinement or GPU acceleration. Actual frame rate and foreground quality depend on input lighting, hardware and simultaneous encoders; sustained Windows performance was not measured here. PiP and keyed results are part of the same Program canvas used by the projector, recording and streaming.

Composition settings are session-only. They are not included in projection project exports. These controls do not create or capture extra source devices; they reuse inputs already in the source deck.

## Program overlays

Live Production now has a **Lyrics, lower thirds & logo** section:

1. Take a song/Bible slide live in Projection Studio. Enable **Show Projection Studio’s live text** to place that text over Program. Later slide changes update it; Clear screen removes that text layer. The live text feed is available even when the projector is showing the camera Program.
2. Type a title and subtitle, click **Apply lower third text**, then enable **Show lower third**. Typing alone does not apply the new text.
3. Click **Choose logo**, select a PNG/JPEG/WebP image, then enable **Show logo at top right**. Loading/replacing the asset leaves it hidden until enabled. Transparent PNG/WebP can preserve a logo’s transparent background.
4. **Hide all overlays** turns off all three layers while keeping their content ready for reuse. Remove logo releases the asset.

Overlays are composited on the final Program canvas after camera/media fades. They appear on the Program monitor, Program projector output, recordings and streams. Preview and input thumbnails show the clean sources. Lower third and logo placement use a fixed broadcast layout in this version. Lyrics use a centered, high-contrast layout with word wrapping and font reduction; text exceeding seven lines ends with an ellipsis. Review/split long passages in Projection Studio. This is live-text integration, not a copy of the legacy slide’s background, font settings, video or 3D presenter.

Overlay content, visibility, selected logo and source selections last only for the current session. There is no graphics/project persistence or custom layout editor in this release.

## Output connection

A 1280 × 720 canvas composites Program at a target 30 fps. A persistent Web Audio destination supplies the mixed audio track. Local WebRTC carries video and mixed audio together to the main output window; Electron IPC relays only the offer/answer and ICE signaling. Actual frame rate depends on hardware. Network publishing is controlled separately in the Streaming workspace; selecting Program for the projector does not start publishing.

Use **Reconnect output** if the output video does not connect or if you closed the output window. It recreates a closed output window or retries the local video connection. A disconnected output shows a waiting screen rather than a stale frame. Projection can still be selected independently.

## Streaming setup and workflow

Streaming requires a locally installed FFmpeg executable with **libx264**, **AAC**, **RTMP** and **RTMPS/TLS** support. FFmpeg is not bundled or downloaded by this app. Projection, switching, audio mixing and recording can run without it. The app tries `ffmpeg` on PATH; otherwise use **Choose FFmpeg executable** in Streaming to select `ffmpeg.exe`. The selected executable path lasts for this app session. Encoding uses native FFmpeg through argument arrays, without a shell.

1. Prepare a Program source in Live Production, add the required audio channels and unmute those channels and Master.
2. Open **Streaming**. Use your platform’s live dashboard to obtain its current RTMP/RTMPS server URL and stream key. The app does not create or sign in to a platform broadcast.
3. Enter the server URL and key in the separate fields. If the platform supplies a complete publishing URL, paste it in Server URL and leave Stream key blank. URLs containing query authentication must be entered as complete publishing URLs.
4. Optionally add a second or third destination and choose a video bitrate. Each row must point to a different publishing URL.
5. Click **Start streaming**. Watch each destination’s status and verify the public broadcast in its platform dashboard. **Connecting** means the encoder has started; **sending** means FFmpeg has reported output progress. Neither status confirms platform approval or that viewers can see a public broadcast.
6. Click **Stop streaming**, or use the persistent **STREAM · STOP** header control from another workspace. Stopping streaming leaves the local recording, source cameras and mixer running.

Publish settings target 1280 × 720, 30 fps, H.264, AAC at 128 kbps and a two-second keyframe interval. Available video bitrates are 2500, 3000, 4000 and 6000 kbps. These are generic settings; check your platform’s current ingest requirements. Each destination runs a separate FFmpeg encoder, so CPU and upload demand increase with destination count. This is direct multi-destination publishing, not a hosted relay service.

Destinations, keys and selected FFmpeg location are kept in memory for the current app session. They are not included in project exports or stored in localStorage. The separate stream-key field is masked; complete URLs pasted into Server URL are displayed as entered. Public status/error messages do not include publishing URLs or keys. FFmpeg receives publishing credentials as native process arguments, so these fields are not a secret vault.

If one destination fails, its status is shown while the remaining destinations continue. If all destinations fail, capture stops and reports an error. There is no automatic reconnect or per-destination retry in this version; stop, correct the settings, and start again. Network/backpressure timeouts and a bounded capture queue prevent unlimited buffering. Stop waits for queued input and encoder shutdown, with a forced-termination timeout for a stuck encoder.

Streaming always captures the Live Production **Program** canvas and Master audio, independently of the selected projector output. It includes enabled Program overlays, including the live-text lyrics layer. Preview panels, stage output and AI speech are not captured. Streaming and local Program recording can run together; they use independent capture tracks. Normal app-close/reload requests stop both before finishing exit/reload. Forced termination and power loss cannot guarantee a clean network disconnect.

Protocol and encoder references: [FFmpeg protocols](https://ffmpeg.org/ffmpeg-protocols.html) and [FFmpeg documentation](https://ffmpeg.org/ffmpeg.html).

## Program recording

1. Prepare your Program camera or test-pattern source and audio mix. Recording includes the Master output: muted channels or muted Master record silence.
2. Click **Start recording** in Live Production and choose a `.webm` destination in the native Save dialog. Canceling the dialog leaves recording idle.
3. The timer, written file size and REC indicator show progress. Camera cuts/fades, microphones and file playback continue normally during recording.
4. Click **Stop recording**, or the header’s **REC · STOP** button from either workspace. Wait for **saved** and the saved path before moving or opening the file.

The recorder saves the Live Production Program canvas plus its mixed audio, including enabled lyrics/lower-third/logo overlays. It does not capture the operator screen, Preview, stage display or the complete legacy Projection Studio output. Changing which workspace is visible or which output is on the projector does not change the recording source. A working projector/WebRTC connection is not required to record.

Output is WebM with a supported browser video encoder (VP8 preferred) and mixed audio (Opus where supported). Target rates are 1280 × 720 at 30 fps, 5 Mbps video and 160 kbps audio; actual performance depends on hardware. Automatic MP4 conversion, seek-index finalization, pause/resume and per-input ISO recording are not implemented. WebM duration/seek information may vary by player.

Recording data is sent in ordered chunks to the Electron main process and written incrementally to a unique `.part` file next to the selected destination. Stop waits for the final encoder chunk and all pending disk writes, syncs/closes the file, then renames it to the selected destination. The complete service is not retained in renderer memory. A 64 MiB queue limit stops recording if disk writes cannot keep up. Failed/aborted writes keep a partial file and report its path; a partial file is not guaranteed playable and is never reported as saved.

Closing the operator window or quitting normally requests Stop and waits for finishing before exit. A reload request during recording requests Stop before reloading. Forced termination, power loss, OS shutdown and renderer crashes cannot guarantee a finalized recording; retain any `.part` file for possible recovery. Do not rely on partial files as a backup.

Audio/video capture tracks used only by the recorder are released on Stop. Stopping recording leaves cameras, the mixer and projector stream running. Recording state and destinations are session-only and are not included in projection project exports.

## Audio Mixer workflow

1. Open Live Production and scroll to **Audio Mixer**.
2. Click **Enable / refresh audio**, grant microphone access, select a microphone and click **+ Add microphone**. Audio-capable capture devices can appear in this list too.
3. Alternatively, click **+ Audio file** and choose local audio, or **+ Test tone** to test without a microphone. Imported files use Play/Pause and do not start automatically.
4. Unmute the desired channel, adjust its volume, then click **Unmute Master**. New channels and Master start muted.
5. Select **Send Program to projector**. The output window receives the mix with Program video. If Chromium blocks audible playback, click **Enable Program audio** in that output window.
6. Switching back to Projection output mutes production audio at the output window. The mixer keeps running so the service mix can be prepared without changing the output. File playback positions continue until paused; returning to Program resumes the current mix.

Meters show post-fader sample peaks in dBFS, with a floor of −60 dBFS. The Master meter is after the Master fader; channel meters are before Master. Red indicates a high level: lower faders if the summed mix approaches or exceeds 0 dBFS. There is no limiter in this release.

The operator does not monitor the mixer on speakers. Program sound uses the output window’s default Windows audio device; output-device selection/headphone monitoring are not implemented. Use headphones for initial microphone tests to avoid speaker feedback. The test tone is 440 Hz and starts muted.

Eight audio channels are supported independently of the eight video input slots. A microphone channel is continuous across camera cuts; audio-follow-video is not implemented. Remove an audio channel to stop its microphone tracks or release its file player. Closing the app releases the mixer and all capture tracks. Imported files remain local path references and must stay in place.

The production mixer does not capture the existing Projection Studio’s media player or speech synthesis. Import audio again in the mixer when it belongs in the production mix. Audio is muted at the output while Projection is selected, but microphone capture continues until its channel is removed or the app closes.

## Existing Projection Studio

The original lyrics, Bible lookup, media import, slide appearance controls, AI assistant, service queue, stage display and project import/export remain in `renderer/operator.html`. The React shell keeps that page mounted in an iframe and shares its preload bridge. This is an incremental React migration: the live production workspace and outer interface are React; the projection editor's internals remain legacy HTML/JavaScript.

Existing remote commands still control projection slides. The Expo mobile source is retained unchanged; it does not switch production cameras or carry production video. This archive does not include a mobile build configuration or an Android APK.

Gemini and online Bible/song discovery retain the previous version's requirements and availability limits. Imported media paths still refer to files on the local machine. Projection project export does not save camera selection, production sources, mixer channels/faders, or output mode; those are session-only.

## Development

- `desktop/src/App.jsx`: React workspace, monitor components and device controls.
- `desktop/src/CompositionPanel.jsx` and `composition.mjs`: PiP controls, chroma/luma alpha processing, edge/spill controls and dependency cleanup.
- `desktop/src/SourceTools.jsx` and `media.mjs`: explicit screen/window source selection and local visual media loading.
- `desktop/src/OverlayPanel.jsx` and `graphics.mjs`: live projection text, lower-third/logo controls and final Program compositing.
- `desktop/src/StreamingPanel.jsx` and `streamer.mjs`: publishing UI, status and bounded Program capture.
- `desktop/streaming-engine.js`: destination validation, FFmpeg processes, multi-destination fan-out and shutdown.
- `desktop/src/recorder.mjs` and `RecordingPanel.jsx`: encoder lifecycle, queue bounds, recording status and controls.
- `desktop/recording-store.js`: incremental disk writes, session validation, finalization and partial-file handling.
- `desktop/src/AudioPanel.jsx` and `audio.mjs`: mixer controls, gain routing, level analysis, microphone/media lifecycle and the persistent mixed audio track.
- `desktop/src/engine.js`: camera lifecycle, test patterns and canvas compositing.
- `desktop/src/switcher.mjs`: pure Cut/Fade and source removal state.
- `desktop/main.js` and `preload.js`: Electron windows and IPC bridge.
- `desktop/renderer/video-output.js`: receiving Program video and output selection.
- `desktop/renderer/dist/`: generated React build and license notices. This directory is rebuilt by `npm start` and is not tracked in GitHub.

```powershell
npm.cmd run build
npm.cmd test
```

Optional browser regression check (uses a mocked Electron bridge and synthetic camera):

```powershell
npm.cmd install --no-save playwright
npx.cmd playwright install chromium
node tests/ui-smoke.cjs
```

The optional browser checks use `ffprobe` and `ffmpeg` on PATH to inspect and decode generated files; FFprobe is only a test dependency; FFmpeg is required to use streaming but not the other app modules.

The separate local protocol test can be run with `node tests/streaming.integration.cjs`. It starts only local RTMP receivers, sends generated test media, and verifies the received H.264/AAC streams. It also verifies that a failed third destination does not stop the two working destinations.

This browser test checks the UI, synthetic camera/microphone lifecycle, tone/file mixing, channel and Master mute/gain, media pause, microphone track release, projection bridge, output routing and WebRTC signaling. It validates a recorded file’s video frames and audio waveform, but does not assert decoded live projector frames or run Electron. It disables WebGL for the browser check, so it does not validate the legacy avatar.

## Validation for this release

- React production bundle built successfully.
- Thirty-five unit tests passed, including chroma alpha, feather/spill behavior, neutral-key handling, bright/dark luma modes, PiP bounds and layer dependency cleanup, plus aspect-ratio bounds, word/Unicode wrapping, visible text overflow, publishing URL validation, diagnostics without credentials, encoder arguments and missing-FFmpeg cleanup, plus codec selection, ordered disk writes, partial writes, duplicate session rejection, empty-file rejection, disk errors, gain bounds, audio-clock smoothing, mute precedence, dBFS peak calculations and the original eight switcher state cases: immediate cuts, fade completion, repeated takes during a fade, same-source takes, source disconnection and clamped transition progress.
- Headless Chromium checks passed for pattern selection, Cut/Fade swapping, synthetic camera capture/removal, preserved projection controls/bridge, output mode restoration and layout at 1440px and 1000px widths, with no uncaught page exceptions. Audio checks also passed for initial silence, post-fader meters, channel/Master gain and mute, a synthetic microphone and WAV file playback/pause, track cleanup, and a negotiated remote audio track.
- Local WebRTC offer/answer signaling reached stable state and supplied a remote MediaStream. Decoded projector video was NOT verified: the execution sandbox did not provide usable ICE candidates. Test actual Program playback on your Windows PC before using it for a service.
- A real MediaRecorder recording was written through the tested disk writer using a mocked Electron bridge. FFprobe/FFmpeg verified VP8 video, Opus audio, a camera-switcher cut to black and a non-silent mixed test tone. Browser checks also passed for save-dialog cancellation, disk-error/partial handling, retry and a simulated app-close request that finalized the file before allowing exit. Native Windows Save dialog and close interception were not exercised.
- Two localhost RTMP receivers received and decoded H.264 video and AAC audio from the real FFmpeg pipeline. A failed third destination was isolated. Browser integration verified live Program publishing to two local receivers while recording, and verified that Stop recording left publishing active. All publishing tests targeted loopback receivers; external platform login, stream keys, public broadcasts and RTMPS TLS connections were not tested.
- Browser checks passed for capture-picker cancellation/selection with a synthetic display stream, stopping capture tracks, image inputs, paused video import, Play/Pause/Restart/Loop and media release. The real Projection Studio iframe drove live text updates and Clear screen. A recorded file was decoded and its pixels confirmed lyrics, lower-third graphics and the logo; Hide all removed them from Program. Native desktopCapturer enumeration and the OS screen/window stream were mocked, so native Windows screen capture was not verified.
- Synthetic green-screen pixels verified that chroma keying removes green while retaining a red subject over a blue Program background. Browser checks verified PiP source/position/size, luma mode, and source removal disabling dependent layers. A recorded file was decoded and pixel checks verified both the inset and keyed composition. This does not validate hair/edge quality on a real camera or sustained keying performance.
- A Windows Electron session, real cameras/capture devices, physical displays, GPU/avatar behavior and long-running performance were not tested here.

## Next modules

Audio-follow-video, direct camera audio integration, ISO recording, NDI, RTMP/SRT source inputs, SRT publishing, advanced matte refinement, GPU keying, editable graphics layouts, virtual camera, desktop installer and production controls for the mobile remote are not implemented in v17.
