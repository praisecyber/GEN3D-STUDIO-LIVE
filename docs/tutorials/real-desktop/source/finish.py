"""Encode the continuous screen capture; add captions without inserting still slides."""
import hashlib,json,re,subprocess,textwrap
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent;WORK=Path('/workspace/.gen3d-real-tutorial')
log=(WORK/'recording-actions.log').read_text();assert 'Real desktop recording complete.' in log and 'Error:' not in log,'Recording did not finish; do not publish a partial capture'
timeline=json.loads((WORK/'timeline.json').read_text());assert all('Operating: '+c['id']+' ' in log for c in timeline['chapters']),'Not all chapters were recorded';srt=(ROOT/'GEN3D-Real-Desktop-Walkthrough.srt').read_text();events=[]
def stamp(value):
 h,m,tail=value.split(':');s,ms=tail.split(',');return f'{int(h)}:{m}:{s}.{int(ms)//10:02d}'
for block in srt.strip().split('\n\n'):
 lines=block.splitlines();start,end=lines[1].split(' --> ');content=r'\N'.join(lines[2:]);events.append(f'Dialogue: 0,{stamp(start)},{stamp(end)},Default,,0,0,0,,{content}\n')
header='[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,30,&H00FFFFFF,&H00FFFFFF,&H90000000,&H90000000,0,0,0,0,100,100,0,0,3,2,0,2,90,90,20,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
ass=WORK/'captions.ass';ass.write_text(header+''.join(events));output=ROOT/'GEN3D-Real-Desktop-Walkthrough.mp4'
subprocess.run(['ffmpeg','-y','-v','error','-i',str(WORK/'continuous.mp4'),'-vf','subtitles=filename='+str(ass),'-af','loudnorm=I=-16:TP=-1.5:LRA=11','-c:v','libx264','-preset','fast','-crf','23','-threads','2','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-ar','48000','-movflags','+faststart',str(output)],check=True)
probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(output)]));duration=float(probe['format']['duration']);assert abs(duration-(timeline['duration']+1))<2
manifest={'title':'GEN3D real desktop walkthrough','version':'0.11.0','duration_seconds':duration,'recording':'Continuous X11 desktop capture with real OS mouse clicks, keyboard typing and the native file picker; English synthetic narration. Recorded on Linux; Windows native dialogs may look different.','gpu_status':'No authenticated Kaggle session or CUDA GPU available. No mock service, GLB fixture or generated-result substitute used. Real GPU generation is NOT demonstrated.','chapters':[{k:c[k] for k in ['id','title','start','duration']} for c in timeline['chapters']],'files':[]}
for p in [output,ROOT/'GEN3D-Real-Desktop-Walkthrough.srt']:
 with p.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
 manifest['files'].append({'name':p.name,'bytes':p.stat().st_size,'sha256':digest})
(ROOT/'video.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Encoded genuine continuous screen recording:',round(duration,1),'seconds')
