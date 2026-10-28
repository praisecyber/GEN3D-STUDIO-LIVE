# Actual GEN3D desktop walkthrough

[Download/watch the real desktop recording](https://github.com/praisecyber/GEN3D-STUDIO-LIVE/releases/download/v0.11.0/GEN3D-Real-Desktop-Walkthrough.mp4) · [Captions](https://github.com/praisecyber/GEN3D-STUDIO-LIVE/releases/download/v0.11.0/GEN3D-Real-Desktop-Walkthrough.srt)

This is actual continuous screen footage of the real app with visible mouse clicks, typing and its native file picker. It is not the earlier narrated screenshot slideshow. Interaction is automated through real UI controls. English narration is synthetic. Recorded on Linux; Windows native dialogs may look different.

Demonstrated: selecting and taking a song live in the app's Main Output monitor, adding a song through typing, preparing and taking John 3:16 from the bundled KJV, opening Online 3D Studio, entering a text request, selecting an image through the real file picker, and showing the unconnected GPU form.

**Not demonstrated:** physical projector output, rendered 3D preview, Kaggle login/notebook startup, a successful GPU connection, Hunyuan inference or a generated mesh. No authenticated Kaggle account/session or CUDA device was available. No mock GPU server, GLB fixture, fabricated connected state or generated-result substitute is used. Generate remains disabled without a real connection.

Image selection uses the official Hunyuan reference input `assets/example_images/1627.png` at upstream revision `f8db63096c8282cb27354314d896feba5ba6ff8a`. The PNG is an input example only, not a model generated during this recording, and is not bundled here. Obtain reference images from their publisher under their license, or use your own. See [Tencent's agreement](../../HUNYUAN3D-LICENSE.txt) and [notice](../../HUNYUAN3D-NOTICE.txt), provided in this repository. Selecting a local image does not upload or generate anything.

The capture uses a separate temporary app profile; it does not change a user's service library or broadcast publicly. The unrelated temporary phone PIN is redacted before recording. No GPU token is entered or displayed. The URL shown is an example of the expected format, not an active session. The [setup guide](../../HUNYUAN3D-ONLINE.md) explains the real Kaggle prerequisites.

## Chapters

- 00:00 — Real desktop recording
- 00:14 — Select a song, preview, then take live
- 00:39 — Add your own song
- 01:07 — Find a Bible verse and take it live
- 01:37 — Find Online 3D Studio
- 01:57 — Enter a real text request
- 02:20 — Choose a reference through the real file picker
- 02:47 — The real Kaggle connection is still required
- 03:11 — End of the real desktop walkthrough

## Narration

### Real desktop recording

This is a real desktop recording with mouse clicks and typing. I will operate projection and prepare Online three D Studio. No Kaggle GPU session is connected, so generation is not demonstrated.

### Select a song, preview, then take live

Start in Projection Studio. Select a song, then click a slide to preview it. Click Take live. Watch the Main Output monitor change to that slide. These are the actual app controls and monitor, not a screenshot placed over the recording.

### Add your own song

To add your own song, open Add a song. Enter a title and paste your lyrics. Leave a blank line between slides. Click Add to library. Select a slide, then use Take live when you are ready. These changes stay in this separate recording profile.

### Find a Bible verse and take it live

Open Offline Bible library. The bundled King James Version is already installed. Type John three sixteen and click Search offline. Prepare passage slides, then click the prepared slide and Take live. The actual Main Output monitor now shows the Bible verse.

### Find Online 3D Studio

Now scroll down in the Output monitors column and open Online three D Studio. This is the actual connection form. A real running Kaggle notebook must supply the H T T P S URL and private access token. I will not fake a connected GPU here.

### Enter a real text request

For a text request, choose Text description and type a description of one complete object. I am entering a friendly orange robot on a plain background. Start with thirty shape steps and seed zero. Generate remains disabled until a real GPU service is connected.

### Choose a reference through the real file picker

For an image request, choose Reference image, then open the real file picker. I am selecting a reference image supplied with the official Hunyuan examples. The filename appears when the app accepts it. Selecting an image does not upload it or generate a mesh.

### The real Kaggle connection is still required

Before generation can run, start the supplied notebook in your own Kaggle account, with GPU and Internet enabled. Configure its private token in Kaggle Secrets. Enter the notebook's printed URL and the same token here, then connect. No authenticated Kaggle session is available in this recording.

### End of the real desktop walkthrough

This recording demonstrated actual desktop operation, without mock generation. The live GPU generation, waiting for a mesh, and reviewing that real result still require a connected Kaggle session. The setup guide and notebook are linked beside this video on GitHub.

## Source and capture

`source/prepare.py` creates narration and captions. `source/record.cjs` operates the app using real OS mouse events, keyboard entry, the HTML select control and the native GTK file picker while FFmpeg captures the X11 desktop. Browser overlays add only a recording banner and click highlights; app handlers/data are not replaced. `source/finish.py` encodes that continuous footage with captions. No still slides are inserted.

Dependencies: the installed Electron/Playwright/Koffi modules, a 1920×1080 Xvfb display with a window manager, X11/XTest libraries, Python, and FFmpeg with x11grab, libflite, libx264 and libass. For this prepared cloud workspace:

```bash
python3 docs/tutorials/real-desktop/source/prepare.py
# Start the isolated Xvfb :100 display and window manager first.
# Put your own permitted PNG at /workspace/.gen3d-real-tutorial/reference.png
DISPLAY=:100 node docs/tutorials/real-desktop/source/record.cjs > /workspace/.gen3d-real-tutorial/recording-actions.log 2>&1
python3 docs/tutorials/real-desktop/source/finish.py
```

`GEN3D_RECORD_FAST=1` is only a preflight check and is not publishable. The final encoder requires every chapter and the normal recording's completion marker. `video.json` records the final duration, chapters and checksums. The release workflow verifies hashes before upload.
