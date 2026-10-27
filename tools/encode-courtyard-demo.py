#!/usr/bin/env python3
"""Encode retained actual-browser frames with captions outside the original viewport."""
import pathlib,json,subprocess,sys,hashlib,argparse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--take',required=True,type=pathlib.Path)
parser.add_argument('--reopen',type=pathlib.Path)
parser.add_argument('--output',required=True,type=pathlib.Path)
args=parser.parse_args()
take=args.take.resolve();reopen=(args.reopen or pathlib.Path(str(args.take)+'-reopen')).resolve();out=args.output.resolve()
assert not out.exists();out.mkdir()
receipt=json.loads((take/'recording-receipt.json').read_text());again=json.loads((take/'reopen-receipt.json').read_text())
assert again['sourceCommit']==receipt['sourceCommit'],'Original and reopened captures must use the same product source'
segments=[(take,receipt['recording']),(reopen,again['recording'])]
concat=['ffconcat version 1.0'];duration=0.0;framecount=0;intended_pts=[]
for folder,info in segments:
 segment_start=duration
 raw=json.loads((folder/'frames/frames.json').read_text());frames=raw['frames'];framecount+=len(frames)
 for i,f in enumerate(frames):
  d=max(.001,(frames[i+1]['receivedSeconds'] if i+1<len(frames) else raw['stoppedSeconds'])-f['receivedSeconds'])
  path=folder/'frames'/f['file'];assert path.exists()
  assert not any(c in str(path) for c in "'\n\r"),'Capture paths containing quotes or line breaks are unsupported'
  intended_pts.append(duration)
  concat.extend(["file '"+str(path)+"'","option framerate 1000","duration "+format(d,'.6f')]);duration+=d
 assert abs(duration-segment_start-info['durationSeconds'])<=.002,'Frame durations must match the recorded segment'
last=segments[-1][0]/'frames'/json.loads((segments[-1][0]/'frames/frames.json').read_text())['frames'][-1]['file']
concat.extend(["file '"+str(last)+"'","option framerate 1000"]);intended_pts.append(duration)
(out/'original-frames.ffconcat').write_text('\n'.join(concat)+'\n')
packet_probe=json.loads(subprocess.run(['ffprobe','-v','error','-f','concat','-safe','0','-i',str(out/'original-frames.ffconcat'),'-show_packets','-show_streams','-of','json'],text=True,capture_output=True,check=True).stdout)
assert packet_probe['streams'][0]['width']==1280 and packet_probe['streams'][0]['height']==900,'Preserve the recorded viewport dimensions'
observed_pts=[float(x['pts_time']) for x in packet_probe['packets']]
assert len(observed_pts)==len(intended_pts)
max_pts_error=max(abs(a-b) for a,b in zip(observed_pts,intended_pts))
assert max_pts_error<=.0011,max_pts_error
(out/'input-timing.json').write_text(json.dumps({'intended_pts':intended_pts,'observed_pts':observed_pts,'max_error_seconds':max_pts_error},indent=2))
def timestamp(sec):
 n=round(sec*100);return str(n//360000)+':'+str((n//6000)%60).zfill(2)+':'+str((n//100)%60).zfill(2)+'.'+str(n%100).zfill(2)
def safe(s):return s.replace('\\','/').replace('{','(').replace('}',')').replace('\n',' ')
timeline=receipt['timeline'];labels=["A fictional courtyard. A conceptual model—not a real-site forecast.","Copy the existing site: same starting geometry, same hypothetical rain.","Change D4 to a rain garden. Its infiltration rate is an assumption.","Compare calculated water outcomes. Water accounting is not field validation.","Inspect both maps at the same modeled time. Simulated depth is not a reading.","Retain an explicitly fictional reading with time, uncertainty and source.","Export the project and its fictional teaching reading."]
labels[5]='Retain an explicitly fictional reading with time, uncertainty and source.'
labels[6]='Export the project and its fictional teaching reading.'
assert [t['id'] for t in timeline]==['intro','matched','change','consequences','same-time','reading','export'],'Do not reuse captions for a different course'
entries=[]
for i,t in enumerate(timeline):
 end=timeline[i+1]['atSeconds'] if i+1<len(timeline) else receipt['recording']['durationSeconds']
 entries.append({'id':t['id'],'start':t['atSeconds'],'end':end,'text':labels[i]})
entries.append({'id':'reopen','start':receipt['recording']['durationSeconds'],'end':duration,'text':'Reopen the actual file in a fresh browser: the inputs and calculation match.'})
header='''[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 1012
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,DejaVu Sans,23,&H00FFFFFF,&H00FFFFFF,&H00162D30,&H00162D30,0,0,0,0,100,100,0,0,1,0,0,8,50,50,0,1
Style: Boundary,DejaVu Sans,16,&H00BAE6D5,&H00BAE6D5,&H00162D30,&H00162D30,1,0,0,0,100,100,0,0,1,0,0,8,30,30,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
lines=[header]
lines.append('Dialogue: 0,0:00:00.00,'+timestamp(duration)+',Boundary,,0,0,0,,{\\an8\\pos(640,916)}FICTIONAL COURTYARD  |  CONCEPTUAL MODEL  |  PRIVATE DEMONSTRATION')
for e in entries:lines.append('Dialogue: 1,'+timestamp(e['start'])+','+timestamp(e['end'])+',Caption,,0,0,0,,{\\an8\\pos(640,947)}'+safe(e['text']))
(out/'captions.ass').write_text('\n'.join(lines)+'\n')
(out/'captions.json').write_text(json.dumps({'source_commit':receipt['sourceCommit'],'duration_seconds':duration,'timeline':entries,'silent':True,'persistent_label':'FICTIONAL COURTYARD | CONCEPTUAL MODEL | PRIVATE DEMONSTRATION'},indent=2))
filters=subprocess.run(['ffmpeg','-hide_banner','-filters'],text=True,capture_output=True,check=True).stdout
assert ' subtitles ' in filters,'This encoder lacks the required installed subtitles filter'
cmd=['ffmpeg','-hide_banner','-nostdin','-n','-f','concat','-safe','0','-i',str(out/'original-frames.ffconcat'),'-vf','fps=30,pad=1280:1012:0:0:color=0x102a31,subtitles=captions.ass','-t',format(duration,'.6f'),'-fps_mode','cfr','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-threads','2','-movflags','+faststart','-an',str(out/'experimental-earth-courtyard-private-demo.mp4')]
p=subprocess.run(cmd,cwd=out,text=True,capture_output=True,timeout=180)
(out/'encoding.log').write_text(p.stdout+p.stderr)
assert p.returncode==0,p.stderr[-3000:]
probe=json.loads(subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(out/'experimental-earth-courtyard-private-demo.mp4')],text=True,capture_output=True,check=True).stdout)
stream=probe['streams'][0];assert stream['width']==1280 and stream['height']==1012
actual=float(probe['format']['duration']);assert abs(actual-duration)<=.04,(duration,actual)
(out/'ffprobe.json').write_text(json.dumps(probe,indent=2))
samples=[]
for i,e in enumerate(entries):
 t=min(e['end']-.35,e['start']+(e['end']-e['start'])*.65)
 path=out/('frame-'+str(i).zfill(2)+'-'+e['id']+'.png')
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-n','-ss',str(t),'-i',str(out/'experimental-earth-courtyard-private-demo.mp4'),'-frames:v','1',str(path)],check=True,timeout=15)
 samples.append({'path':str(path),'time':t,'stage':e['id']})
video=out/'experimental-earth-courtyard-private-demo.mp4'
summary={'status':'ENCODED_PENDING_INDEPENDENT_PIXEL_AND_PLAYBACK_REVIEW','source_commit':receipt['sourceCommit'],'encoder_sha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest(),'encoding_command':cmd,'source_frame_count':framecount,'original_frame_duration_seconds':duration,'encoded_duration_seconds':actual,'width':1280,'height':1012,'silent':True,'video':str(video),'bytes':video.stat().st_size,'sha256':hashlib.sha256(video.read_bytes()).hexdigest(),'samples':samples,'caption_layout':'112px separate editorial band below the unmodified1280x900 browser viewport','source_segments':[str(take),str(reopen)],'same_browser_sandbox_admitted':receipt['sandbox']['admitted'] and again['sandbox']['admitted'],'max_input_timestamp_error_seconds':max_pts_error,'duration_bound_seconds':duration,'published':False,'submitted':False}
(out/'encoding-receipt.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary),flush=True)

