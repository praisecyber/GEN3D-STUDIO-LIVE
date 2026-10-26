# Independent stage displays and presentation exports

## Choir and pastor views

1. Open Projection Studio and expand **Independent stage displays** in the monitors panel.
2. Use **New stage window**, then select a connected monitor and optionally enable full screen. Do not assign a full-screen stage window to the operator monitor unless that is intentional.
3. Name the layout. Set its colors and uppercase preference. Each clock, lyrics, next-slide, countdown, message and count widget has visibility, position, dimensions and font-size controls. Coordinates and dimensions are percentages of the display; font size is a percentage of its height.
4. Use **Apply and save layout**. Changes affect that stage window, leaving projector and Program routing unchanged.
5. Use **Refresh monitors** after connecting hardware. Disconnected destinations fall back to a window on the primary screen. Close unwanted windows with **Close selected window**.

Up to eight stage windows can be open. Their layouts are machine settings saved in Electron user data, separate from project backups. All stage windows still share the current slide, next slide, message and countdown cues. The original default stage follows global stage settings until given its own layout.

## Export a video with a presenter

1. Select a song or Bible presentation. Open **Export presentation** and choose **Timed WebM video**.
2. Choose 720p or 1080p and seconds per slide. A still image, color or looping video can supply the background.
3. For a presenter, enable **Include selected 3D avatar in WebM**. Choose a self-contained GLB in **3D avatar & recorded vocals**, or use the default orange robot. The export places the presenter on the right side; text uses the selected slide style.
4. For audio, first choose a vocal recording in the presenter panel, then enable **Include chosen vocal recording in WebM**. The export starts its own copy from the beginning without playing it through operator speakers or changing live output. Supported avatar mouth morphs follow its amplitude.
5. Export and keep the operator open until recording finishes. **Cancel video export** discards the unfinished export.

WebM records in real time, with a maximum of ten minutes total and 200 MB. Frame rate depends on rendering/encoding performance; software rendering can be slower. System speech synthesis and generated singing are not recorded. HTML and PNG ZIP remain still-image exports. These workflows were tested in cloud Electron; physical multi-monitor/audio-device acceptance remains outstanding.
