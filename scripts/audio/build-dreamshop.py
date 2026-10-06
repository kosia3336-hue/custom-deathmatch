"""Render the original Dreamshop skin's six soft synth cues to mono PCM WAV.
Run: python3 scripts/audio/build-dreamshop.py (standard library only).
No browser synthesis or external samples. Deterministic assets, no runtime DSP.
"""
from pathlib import Path
import math, wave, struct, json
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/audio/skins/dreamshop'
RATE = 44100
# MIDI pitches, onset, length, gain. All timbres share a rounded bell/pluck voice.
CUES = {
 'win': ('승', '경쾌하게 올라가는 뚱·띵', [(72,0,.26,.72),(79,.095,.32,.85),(84,.19,.30,.6)]),
 'draw': ('무', '동일한 높이로 톡·톡', [(74,0,.24,.72),(74,.14,.29,.72)]),
 'lose': ('패', '부드럽게 내려오는 뚱·땅', [(67,0,.25,.8),(60,.14,.32,.75)]),
 'success': ('베팅 성공', '민트빛 다섯 음의 반짝이는 상승음', [(72,0,.28,.6),(76,.075,.27,.65),(79,.15,.30,.65),(84,.235,.36,.7),(88,.315,.34,.45)]),
 'fail': ('베팅 실패', '낮게 내려앉는 세 음', [(69,0,.25,.7),(65,.095,.28,.75),(60,.20,.34,.8)]),
 'refund': ('베팅 반환', '올라갔다 돌아오는 말랑한 회수음', [(72,0,.25,.72),(79,.10,.25,.6),(72,.225,.33,.75)]),
}
OUT.mkdir(parents=True, exist_ok=True)
manifest=[]
for name,(label,detail,notes) in CUES.items():
 duration=max(start+length for _,start,length,_ in notes)+.025
 signal=[0.0]*math.ceil(duration*RATE)
 for midi,start,length,level in notes:
  freq=440*2**((midi-69)/12)
  for j in range(math.ceil(length*RATE)):
   t=j/RATE
   envelope=min(1,t/.009)*math.exp(-t*10)*min(1,max(0,(length-t)/.065))
   # A quiet second partial adds a bell-like transient without metallic squeal.
   value=(math.sin(2*math.pi*freq*t)+.20*math.sin(2*math.pi*freq*2*t)*math.exp(-t*16)+.06*math.sin(2*math.pi*freq*3*t)*math.exp(-t*24))
   index=int(start*RATE)+j
   signal[index]+=value*envelope*level
 peak=max(abs(x) for x in signal)
 scale=.62/peak
 pcm=b''.join(struct.pack('<h',round(x*scale*32767)) for x in signal)
 with wave.open(str(OUT/(name+'.wav')),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE);f.writeframes(pcm)
 manifest.append({'id':'dreamshop'+name.capitalize(),'name':label,'detail':detail,'category':'skins','src':'/audio/skins/dreamshop/'+name+'.wav','volume':.62,'duration':round(duration,3),'peak':.62,'original':'Original Dreamshop synth composition; scripts/audio/build-dreamshop.py'})
 print(name,round(duration,3),'s',len(pcm),'bytes')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
