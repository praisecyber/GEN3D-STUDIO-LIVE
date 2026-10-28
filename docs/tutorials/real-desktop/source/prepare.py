import json, subprocess, textwrap
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
WORK=Path('/workspace/.gen3d-real-tutorial');WORK.mkdir(exist_ok=True)
chapters=json.loads((ROOT/'source/chapters.json').read_text());elapsed=0;captions=[];audio=[]
def run(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def ts(seconds):
 ms=round(seconds*1000);return f'{ms//3600000:02d}:{ms//60000%60:02d}:{ms//1000%60:02d},{ms%1000:03d}'
for i,c in enumerate(chapters):
 speech=WORK/f'{i:02d}.txt';speech.write_text(c['narration']);wav=WORK/f'{i:02d}.wav'
 run(['ffmpeg','-y','-v','error','-f','lavfi','-i',f'flite=textfile={speech}:voice=slt','-ar','48000','-c:a','pcm_s16le',str(wav)])
 length=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',str(wav)]));duration=max(c['seconds'],length+2);c.update(start=round(elapsed,3),duration=round(duration,3));padded=WORK/f'{i:02d}-padded.wav';run(['ffmpeg','-y','-v','error','-i',str(wav),'-af','apad','-t',str(duration),'-ar','48000','-c:a','pcm_s16le',str(padded)]);audio.append(padded)
 words=c['narration'].split();used=0
 for j in range(0,len(words),13):
  group=words[j:j+13];start=elapsed+length*used/len(words);used+=len(group);end=elapsed+length*used/len(words);captions.append((start,end,' '.join(group)))
 elapsed+=duration
listing=WORK/'audio.txt';listing.write_text(''.join(f"file '{p}'\n" for p in audio));run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-c','copy',str(WORK/'narration.wav')]);(WORK/'timeline.json').write_text(json.dumps({'duration':elapsed,'chapters':chapters},indent=2)+'\n');(ROOT/'GEN3D-Real-Desktop-Walkthrough.srt').write_text('\n\n'.join(f'{i+1}\n{ts(a)} --> {ts(b)}\n{textwrap.fill(text,84)}' for i,(a,b,text) in enumerate(captions))+'\n');print('Prepared real-time narration:',round(elapsed,1),'seconds')
