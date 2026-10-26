# Windows 11 and Android acceptance

Status: not executed on physical devices. Cloud regression results are separate in `CURRENT-VALIDATION.json`. Use a spare test service/project, dummy content and local receivers first. Record the Windows/Android version, GEN3D build, device/driver versions, result and supporting log for each case.

| Case | Action | Required observation |
| --- | --- | --- |
| Windows installation | Verify installer SHA-256 against `BUILD-ARTIFACTS.json`, install 0.10.1 as the current user, launch and restart | Launch succeeds; songs/settings survive restart; no administrator requirement for the per-user install |
| Main and stage outputs | Attach projector and stage monitor; assign independent windows, change lyrics, clear output and disconnect/reconnect a monitor | Main output and stage cues reach the assigned screens; clearing removes live content; disconnected displays recover without losing the library |
| Holyrics | Enable read-only API access in the installed current Holyrics version; follow `HOLYRICS-IMPORT.md`; read without applying, then import a small reviewed sample | Live output and source library stay unchanged during review; order, repeated choruses, credits and chosen group filters survive import/restart; local duplicates remain intact |
| Capture and audio | Add each actual camera/capture card and microphone; check preview, cut/fade, mute, gain and audio-follow-video | Correct video and audible channels; muted sources are silent; unplugged inputs fail clearly |
| NDI | Install licensed NDI 6 runtime; discover an actual LAN sender; receive video/audio, switch to it and remove it | Correct picture/audio and cleanup; log sender/runtime versions and network topology |
| Recording | Record Program and two isolated inputs, stop, inspect the resulting files | Each file plays with the intended picture/audio and durations; no false successful save on disk failure |
| PowerPoint | Close existing PowerPoint sessions; import a representative PPTX with pictures/fonts/aspect ratio | Static slide visuals and slide order match; Preview/Take/Clear work; original file is unchanged. Animation parity is not implemented |
| OBS Virtual Camera | Start OBS with WebSocket and driver installed, no active production session; enable GEN3D virtual camera, select it in Zoom/Meet, then stop | Live Program picture reaches the meeting; stopping restores the previous OBS scene |
| Android | Install the release APK; pair over trusted Wi-Fi; switch a test slide, view Program, save an offline snapshot, disconnect/reconnect | PIN authentication, command, preview, offline KJV and reconnection work; offline snapshot cannot issue live commands |
| Uninstall/reinstall | Exit GEN3D, uninstall and reinstall the same build | Application files uninstall correctly; saved user data remains available after reinstall |

Android instrumentation sources and exact commands are in `mobile/android/tests/README.md`. Run the stock-WebView baseline before the workflow and recovery tests. A working provider is required; the cloud software emulator's baseline fails. The dummy server tests controls and snapshots; it does not establish live Program preview or actual desktop integration.

Do not mark local protocol fixtures as compatibility with a real Holyrics installation, or loopback streaming receivers as acceptance by a public streaming provider. External publishing needs configured accounts and a deliberate test destination. Windows publisher signing remains unavailable.
