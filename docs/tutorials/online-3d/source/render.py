"""Render an English narrated, captioned MP4 from real app screenshots and setup cards.
Dependencies: Pillow; FFmpeg/FFprobe with libflite, libx264 and libass.
No Kaggle UI or inference results are fabricated. See the permanently labelled sample scenes.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import textwrap
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
TUTORIAL = HERE.parent
WORK = Path(os.environ.get('GEN3D_TUTORIAL_WORK', '/workspace/.gen3d-tutorial-build'))
WORK.mkdir(parents=True, exist_ok=True)
FONT = Path('/usr/share/fonts/truetype/dejavu')
W, H = 1920, 1080
BG = '#10141f'
FG = '#f4f6fa'
MUTED = '#bcc7d8'
ORANGE = '#ff943f'
SCENES = json.loads((HERE / 'scenes.json').read_text())


def run(args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def font(size, bold=False, mono=False):
    name = 'DejaVuSansMono.ttf' if mono else 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    return ImageFont.truetype(str(FONT / name), size)


def wrap(draw, text, f, width):
    lines, line = [], ''
    for word in text.split():
        candidate = (line + ' ' + word).strip()
        if draw.textlength(candidate, font=f) > width and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    return lines + ([line] if line else [])


def text(draw, xy, value, f, fill=FG, width=530, spacing=12):
    x, y = xy
    for line in wrap(draw, value, f, width):
        draw.text((x, y), line, font=f, fill=fill)
        y += f.size + spacing
    return y


def badge(draw, box, title, fill='#27344a', color=FG, size=26):
    draw.rounded_rectangle(box, radius=14, fill=fill)
    draw.text((box[0] + 22, box[1] + 13), title, font=font(size, True), fill=color)


def card(draw, y, title, body, x=760, width=1070):
    draw.rounded_rectangle((x, y, x + width, y + 150), radius=22, fill='#1c2536', outline='#33445d', width=2)
    draw.text((x + 30, y + 22), title, font=font(30, True), fill=ORANGE)
    text(draw, (x + 30, y + 72), body, font(25), width=width - 60, spacing=8)


def make_slide(scene, i):
    image = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(image)
    d.rectangle((0, 0, W, 10), fill=ORANGE)
    d.text((64, 42), 'GEN3D STUDIO LIVE', font=font(28, True), fill=FG)
    d.text((1420, 48), 'ONLINE 3D  /  v0.11.0', font=font(24), fill=MUTED)
    d.text((64, 135), scene['label'], font=font(22, True), fill=ORANGE)
    y = text(d, (64, 180), scene['title'], font(48, True), width=600, spacing=12) + 40
    for bullet in scene['bullets']:
        d.ellipse((69, y + 13, 81, y + 25), fill=ORANGE)
        y = text(d, (101, y), bullet, font(29), width=535, spacing=12) + 26
    kind = scene['kind']
    if kind in ('ui', 'output'):
        screen = Image.open(TUTORIAL / 'images' / scene['image']).convert('RGB')
        if 'crop' in scene:
            screen = screen.crop(tuple(scene['crop']))
        screen.thumbnail((1050, 700), Image.Resampling.LANCZOS)
        # Enlarge small UI crops enough to read. Preserve aspect ratio.
        factor = min(1050 / screen.width, 700 / screen.height)
        screen = screen.resize((round(screen.width * factor), round(screen.height * factor)), Image.Resampling.LANCZOS)
        x, sy = 755 + (1070 - screen.width) // 2, 185 + (700 - screen.height) // 2
        d.rounded_rectangle((x - 16, sy - 16, x + screen.width + 16, sy + screen.height + 16), radius=18, fill='#27344a')
        image.paste(screen, (x, sy))
        if scene.get('fixture'):
            badge(d, (770, 110, 1810, 168), 'UI DEMO • sample model, not Hunyuan output', '#673d1a', '#ffe1c6', 25)
        else:
            badge(d, (800, 110, 1780, 168), 'ACTUAL APP CONTROLS • enter YOUR notebook URL', '#223b4f', '#d7f2ff', 24)
    elif kind == 'intro':
        shot = Image.open(TUTORIAL / 'images' / '01-workspace.png').convert('RGB')
        shot.thumbnail((1070, 600), Image.Resampling.LANCZOS)
        image.paste(shot, (755, 200))
        badge(d, (780, 825, 1810, 884), 'SETUP WALKTHROUGH • GPU inference not demonstrated', '#673d1a', '#ffe1c6', 23)
    elif kind == 'downloads':
        card(d, 220, 'WINDOWS INSTALLER', 'GEN3D-Studio-Live-0.11.0-Windows-x64.exe')
        card(d, 405, 'KAGGLE NOTEBOOK', 'GEN3D-Kaggle.ipynb')
        card(d, 590, 'GITHUB RELEASE', 'github.com/praisecyber/GEN3D-STUDIO-LIVE\nreleases/tag/v0.11.0')
    elif kind == 'kaggle':
        card(d, 210, 'IMPORT THE SUPPLIED NOTEBOOK', 'Use your own Kaggle account. Follow its current import controls.')
        card(d, 395, 'GPU + INTERNET', 'Select a CUDA accelerator. Your Kaggle account must have access.')
        card(d, 580, 'TEMPORARY PERSONAL SESSION', 'Keep the server cell running. Kaggle decides availability and limits.')
        d.text((780, 805), 'Instruction cards — not a recording of the Kaggle website', font=font(23), fill=MUTED)
    elif kind == 'secret':
        card(d, 220, 'SECRET NAME — COPY EXACTLY', 'GEN3D_GPU_TOKEN')
        card(d, 405, 'PRIVATE VALUE', 'Use your own unique random value. No token is shown in this video.')
        card(d, 590, 'ENABLE NOTEBOOK ACCESS', 'The notebook reads the value securely through Kaggle Secrets.')
    elif kind == 'notebook':
        card(d, 210, 'SETUP CELL', 'Clones GEN3D; asks for the full legal name of the GPU service provider.')
        card(d, 395, 'SERVER CELL', 'Loads Kaggle Secret; checks CUDA/imports; starts authenticated service.')
        card(d, 580, 'COPY THE PRINTED HTTPS URL', 'Paste into GEN3D. The URL changes after a new notebook session.')
        d.text((780, 805), 'Do not close the running server cell.', font=font(28, True), fill=ORANGE)
    elif kind == 'finish':
        card(d, 210, 'TESTED', 'App workflow, authentication, queue, cancellation, GLB storage and review.')
        card(d, 395, 'NOT YET VERIFIED', 'Actual Hunyuan / SDXL inference and memory fit on a Kaggle GPU.')
        card(d, 580, 'FULL SETUP GUIDE', 'GitHub → docs/HUNYUAN3D-ONLINE.md')
        d.text((785, 805), 'Keep your token private. Save your downloaded models.', font=font(25, True), fill=ORANGE)
    d.rectangle((64, 928, W - 64, 932), fill='#354256')
    d.rectangle((64, 928, 64 + round((W - 128) * (i + 1) / len(SCENES)), 932), fill=ORANGE)
    d.text((64, 944), f'{i + 1:02d} / {len(SCENES):02d}  •  Narrated setup guide', font=font(20), fill=MUTED)
    filename = WORK / f'scene-{i:02d}.png'
    image.save(filename)
    return filename


def timestamp(seconds):
    ms = round(seconds * 1000)
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


captions, chapters, segments, elapsed = [], [], [], 0.0
for i, scene in enumerate(SCENES):
    print('Rendering', i + 1, scene['title'], flush=True)
    slide = make_slide(scene, i)
    speech = WORK / f'narration-{i:02d}.txt'
    speech.write_text(scene['narration'])
    wav = WORK / f'narration-{i:02d}.wav'
    run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', f'flite=textfile={speech}:voice=slt', '-ar', '48000', '-c:a', 'pcm_s16le', str(wav)])
    audio_duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(wav)]))
    duration = audio_duration + 1.4
    chapters.append({'start': round(elapsed, 3), 'title': scene['title'], 'duration': round(duration, 3)})
    words = scene['narration'].split()
    groups = [words[j:j + 14] for j in range(0, len(words), 14)]
    used = 0
    for group in groups:
        start = elapsed + audio_duration * used / len(words)
        used += len(group)
        end = elapsed + audio_duration * used / len(words)
        captions.append((start, end, ' '.join(group)))
    segment = WORK / f'scene-{i:02d}.mp4'
    run(['ffmpeg', '-y', '-v', 'error', '-loop', '1', '-framerate', '24', '-i', str(slide), '-i', str(wav), '-vf', f'fade=t=in:st=0:d=0.25,fade=t=out:st={duration-.25}:d=0.25', '-af', 'apad,alimiter=limit=0.95', '-t', str(duration), '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', str(segment)])
    segments.append(segment)
    elapsed += duration
srt = TUTORIAL / 'GEN3D-Online-3D-Studio-Tutorial.srt'
srt.write_text('\n\n'.join(f'{i + 1}\n{timestamp(a)} --> {timestamp(b)}\n{textwrap.fill(line, width=84)}' for i, (a, b, line) in enumerate(captions)) + '\n')
listing = WORK / 'segments.txt'
listing.write_text(''.join(f"file '{p}'\n" for p in segments))
combined = WORK / 'combined.mp4'
run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(listing), '-c', 'copy', '-movflags', '+faststart', str(combined)])
output = TUTORIAL / 'GEN3D-Online-3D-Studio-Tutorial.mp4'
# Captions have reserved footer space and do not cover the controls.
ass = WORK / 'captions.ass'
def ass_time(seconds):
    cs = round(seconds * 100)
    return f'{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}'
header = '[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,32,&H00FFFFFF,&H00FFFFFF,&H90000000,&H90000000,0,0,0,0,100,100,0,0,3,2,0,2,100,100,22,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
events = []
for start, end, line in captions:
    content = textwrap.fill(line, width=84).replace('\n', r'\N')
    events.append(f'Dialogue: 0,{ass_time(start)},{ass_time(end)},Default,,0,0,0,,{content}\n')
ass.write_text(header + ''.join(events))
run(['ffmpeg', '-y', '-v', 'error', '-i', str(combined), '-vf', f'subtitles=filename={ass}', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-threads', '2', '-pix_fmt', 'yuv420p', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', str(output)])
metadata = {'title': 'GEN3D Online 3D Studio — Setup and Use', 'version': '0.11.0', 'format': '1920x1080 / H.264 / AAC / English synthetic narration / burned-in captions', 'note': 'Real app UI with a clearly labelled procedural sample. No Kaggle website recording or real Hunyuan inference is claimed.', 'chapters': chapters, 'files': []}
for file in [output, srt]:
    with file.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    metadata['files'].append({'name': file.name, 'bytes': file.stat().st_size, 'sha256': digest})
(TUTORIAL / 'video.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Done:', output, round(elapsed, 1), 'seconds', flush=True)
