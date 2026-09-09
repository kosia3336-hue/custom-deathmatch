import { isSfxMuted, getSfxOutput } from '@/lib/sfxSettings';

let ctx: AudioContext | null = null;

/** 마지막 5초: 짧고 건조한 시계의 tick/tock. 공통 SFX 음량·음소거를 따른다. */
export function playCountdownTickSfx(second: number) {
  try {
    const c = getCtx();
    if (!c || c.state !== 'running') return;
    const now = c.currentTime;
    // 기계식 시계의 이스케이프먼트: 짧은 톱니 충격 두 번 + 건조한 공명.
    // 음높이가 미끄러지는 전자음 대신 tick/tock의 음색만 번갈아 바꾼다.
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 0.065), c.sampleRate);
    const samples = buffer.getChannelData(0);
    const frequency = second % 2 ? 2300 : 1650;
    for (let i = 0; i < samples.length; i++) {
      const t = i / c.sampleRate;
      const impulse = Math.exp(-t * 650) + (t >= 0.009 ? 0.48 * Math.exp(-(t - 0.009) * 750) : 0);
      samples[i] = (Math.random() * 2 - 1) * impulse * 0.7
        + Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 160) * 0.18;
    }
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 700;
    const gain = c.createGain();
    gain.gain.value = 0.6;
    source.connect(filter); filter.connect(gain); gain.connect(getSfxOutput(c));
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(now);
  } catch { /* 오디오 미지원 환경에서도 게임은 계속한다. */ }
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (isSfxMuted()) return null;
  if (!ctx || ctx.state === 'closed') {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** 추첨 룰렛 핑 효과음 — 띵 */
export function playLotteryPingSfx() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(getSfxOutput(c));
    osc.start(now);
    osc.stop(now + 0.07);
  } catch {}
}

/** 추첨 결과 확정 효과음 — 타악 */
export function playLotteryFinalSfx() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    // 저음 타격
    const osc = c.createOscillator();
    const oGain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
    oGain.gain.setValueAtTime(0.55, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(oGain); oGain.connect(getSfxOutput(c));
    osc.start(now); osc.stop(now + 0.22);

    // 노이즈 임팩트
    const bufLen = Math.ceil(c.sampleRate * 0.12);
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const nGain = c.createGain();
    nGain.gain.setValueAtTime(0.35, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    src.connect(lp); lp.connect(nGain); nGain.connect(getSfxOutput(c));
    src.start(now); src.stop(now + 0.12);

    // 고음 링 (밝은 느낌)
    const osc2 = c.createOscillator();
    const oGain2 = c.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1400, now);
    osc2.frequency.exponentialRampToValueAtTime(700, now + 0.09);
    oGain2.gain.setValueAtTime(0.18, now);
    oGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc2.connect(oGain2); oGain2.connect(getSfxOutput(c));
    osc2.start(now); osc2.stop(now + 0.12);
  } catch {}
}

/** 밴 슬래시 효과음 — 촤악 */
export function playBanSfx() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const dur = 0.32;

    // 노이즈 버퍼 생성
    const bufLen = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    // ── Layer 1: 넓은 밴드패스 스윕 ("촤" 의 메인 바람 소리) ──
    const src1 = c.createBufferSource();
    src1.buffer = buf;

    const bp1 = c.createBiquadFilter();
    bp1.type = 'bandpass';
    bp1.frequency.setValueAtTime(3500, now);
    bp1.frequency.exponentialRampToValueAtTime(300, now + dur);
    bp1.Q.value = 0.7;

    const g1 = c.createGain();
    g1.gain.setValueAtTime(0, now);
    g1.gain.linearRampToValueAtTime(1.4, now + 0.012);
    g1.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src1.connect(bp1);
    bp1.connect(g1);
    g1.connect(getSfxOutput(c));
    src1.start(now);
    src1.stop(now + dur);

    // ── Layer 2: 공명 높은 밴드패스 ("악" 의 날카로운 꼬리) ──
    const src2 = c.createBufferSource();
    src2.buffer = buf;

    const bp2 = c.createBiquadFilter();
    bp2.type = 'bandpass';
    bp2.frequency.setValueAtTime(1800, now + 0.02);
    bp2.frequency.exponentialRampToValueAtTime(220, now + dur);
    bp2.Q.value = 4;

    const g2 = c.createGain();
    g2.gain.setValueAtTime(0, now + 0.02);
    g2.gain.linearRampToValueAtTime(0.6, now + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src2.connect(bp2);
    bp2.connect(g2);
    g2.connect(getSfxOutput(c));
    src2.start(now);
    src2.stop(now + dur);
  } catch {
    // 브라우저 미지원 시 무시
  }
}

/** 랭크 매칭 성사 시 짧은 벨(승리 알림 느낌) */
export function playRankMatchBellSfx() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    const playTone = (freq: number, delay: number, dur: number, vol: number) => {
      const t0 = now + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(getSfxOutput(c));
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    };

    playTone(784, 0, 0.2, 0.12);
    playTone(988, 0.11, 0.22, 0.1);
    playTone(1319, 0.24, 0.35, 0.08);
  } catch {
    /* ignore */
  }
}

/** 밴 삭제 복원음 — 뽁+띵 (ban의 역방향, 상승 톤) */
export function playUnbanSfx() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    // Layer 1: 팝 (사인파 200Hz→80Hz, 0.15s)
    const osc1 = c.createOscillator();
    const g1 = c.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(200, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.15);
    g1.gain.setValueAtTime(0.35, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(g1); g1.connect(getSfxOutput(c));
    osc1.start(now); osc1.stop(now + 0.15);

    // Layer 2: 상승 링 (삼각파 600Hz→1200Hz, 0.2s)
    const osc2 = c.createOscillator();
    const g2 = c.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(600, now);
    osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.18, now + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc2.connect(g2); g2.connect(getSfxOutput(c));
    osc2.start(now); osc2.stop(now + 0.2);

    // Layer 3: 잔향 (사인파 1800Hz, gain 0.06, 0.3s)
    const osc3 = c.createOscillator();
    const g3 = c.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1800, now);
    g3.gain.setValueAtTime(0.06, now);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc3.connect(g3); g3.connect(getSfxOutput(c));
    osc3.start(now); osc3.stop(now + 0.3);
  } catch {}
}

/** 고성 스킨 — 탑 무너지는 소리 (흔들림→돌 충격×7→최후 붕괴) */
export function sfxCitadelCollapse() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    // 저음 진동 (1.5s 내내 깔리는 룸블)
    const rumbleLen = Math.ceil(c.sampleRate * 1.5);
    const rBuf = c.createBuffer(1, rumbleLen, c.sampleRate);
    const rData = rBuf.getChannelData(0);
    for (let i = 0; i < rumbleLen; i++) rData[i] = Math.random() * 2 - 1;
    const rSrc = c.createBufferSource();
    rSrc.buffer = rBuf;
    const rLp = c.createBiquadFilter();
    rLp.type = 'lowpass'; rLp.frequency.value = 160;
    const rGain = c.createGain();
    rGain.gain.setValueAtTime(0, now);
    rGain.gain.linearRampToValueAtTime(0.35, now + 0.3);
    rGain.gain.linearRampToValueAtTime(0.60, now + 0.9);
    rGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    rSrc.connect(rLp); rLp.connect(rGain); rGain.connect(getSfxOutput(c));
    rSrc.start(now); rSrc.stop(now + 1.5);

    // 돌 충격음 — 점점 크고 잦아짐
    const hits = [
      { t: 0.04, freq: 440, q: 7, vol: 0.30, dur: 0.07 },
      { t: 0.20, freq: 290, q: 6, vol: 0.36, dur: 0.08 },
      { t: 0.36, freq: 360, q: 8, vol: 0.40, dur: 0.07 },
      { t: 0.52, freq: 220, q: 5, vol: 0.48, dur: 0.09 },
      { t: 0.68, freq: 310, q: 7, vol: 0.54, dur: 0.08 },
      { t: 0.84, freq: 180, q: 6, vol: 0.62, dur: 0.10 },
      { t: 1.00, freq: 260, q: 7, vol: 0.70, dur: 0.09 },
    ];
    const hBufLen = Math.ceil(c.sampleRate * 0.12);
    const hBuf = c.createBuffer(1, hBufLen, c.sampleRate);
    const hData = hBuf.getChannelData(0);
    for (let i = 0; i < hBufLen; i++) hData[i] = Math.random() * 2 - 1;
    for (const h of hits) {
      const t = now + h.t;
      const s = c.createBufferSource(); s.buffer = hBuf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = h.freq; bp.Q.value = h.q;
      const g = c.createGain();
      g.gain.setValueAtTime(h.vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + h.dur);
      s.connect(bp); bp.connect(g); g.connect(getSfxOutput(c));
      s.start(t); s.stop(t + h.dur);
    }

    // 최후 붕괴 (1.2s) — 저음 타격 + 노이즈 충격
    const ct = now + 1.2;
    const co = c.createOscillator();
    co.type = 'sine';
    co.frequency.setValueAtTime(110, ct);
    co.frequency.exponentialRampToValueAtTime(28, ct + 0.28);
    const cg = c.createGain();
    cg.gain.setValueAtTime(0.95, ct); cg.gain.exponentialRampToValueAtTime(0.001, ct + 0.32);
    co.connect(cg); cg.connect(getSfxOutput(c)); co.start(ct); co.stop(ct + 0.32);

    const cnLen = Math.ceil(c.sampleRate * 0.2);
    const cnBuf = c.createBuffer(1, cnLen, c.sampleRate);
    const cnData = cnBuf.getChannelData(0);
    for (let i = 0; i < cnLen; i++) cnData[i] = Math.random() * 2 - 1;
    const cnSrc = c.createBufferSource(); cnSrc.buffer = cnBuf;
    const cnLp = c.createBiquadFilter(); cnLp.type = 'lowpass'; cnLp.frequency.value = 700;
    const cnG = c.createGain();
    cnG.gain.setValueAtTime(0.85, ct); cnG.gain.exponentialRampToValueAtTime(0.001, ct + 0.2);
    cnSrc.connect(cnLp); cnLp.connect(cnG); cnG.connect(getSfxOutput(c));
    cnSrc.start(ct); cnSrc.stop(ct + 0.2);
  } catch {}
}

/** 고성 스킨 — 탑 완성 종소리 (G장조 4화음 상승) */
export function sfxCitadelComplete() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const tones = [
      { freq: 392, delay: 0,    dur: 0.9,  vol: 0.14 },
      { freq: 523, delay: 0.09, dur: 0.85, vol: 0.12 },
      { freq: 659, delay: 0.18, dur: 0.80, vol: 0.10 },
      { freq: 784, delay: 0.30, dur: 1.00, vol: 0.09 },
    ];
    for (const { freq, delay, dur, vol } of tones) {
      const t = now + delay;
      const osc = c.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.014);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g); g.connect(getSfxOutput(c));
      osc.start(t); osc.stop(t + dur + 0.02);
      // 배음
      const osc2 = c.createOscillator();
      osc2.type = 'triangle'; osc2.frequency.setValueAtTime(freq * 2, t);
      const g2 = c.createGain();
      g2.gain.setValueAtTime(0, t);
      g2.gain.linearRampToValueAtTime(vol * 0.28, t + 0.01);
      g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.55);
      osc2.connect(g2); g2.connect(getSfxOutput(c));
      osc2.start(t); osc2.stop(t + dur * 0.55 + 0.01);
    }
  } catch {}
}

/** 냥냥 스킨 — 타일별 고양이 울음 (public/audio/skins/meow/tile-N.mp3, 타일 0~4) */
const meowTileBuffers = new Map<number, Promise<AudioBuffer | null>>();

function loadMeowTileBuffer(c: AudioContext, tile: number): Promise<AudioBuffer | null> {
  const cached = meowTileBuffers.get(tile);
  if (cached) return cached;
  const p = fetch(`/audio/skins/meow/tile-${tile}.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
    .then((buf) => c.decodeAudioData(buf))
    .catch(() => {
      meowTileBuffers.delete(tile); // 실패 시 재시도 가능하게
      return null;
    });
  meowTileBuffers.set(tile, p);
  return p;
}

/** 냥냥 스킨 — 타일 버튼 클릭 시 해당 타일의 야옹 소리 재생 */
export function playMeowTileSfx(tile: number) {
  try {
    const c = getCtx();
    if (!c) return;
    void loadMeowTileBuffer(c, tile).then((buf) => {
      if (!buf) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = 0.55;
      src.connect(gain);
      gain.connect(getSfxOutput(c));
      src.start();
    });
  } catch {}
}

/** 냥냥 스킨 — 야옹~ (2음절 '야-옹' 피치 컨투어 + 비브라토 + 비음 포먼트) */
export function sfxMeow() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const dur = 0.55;

    // 성대 — 톱니파에 피치 컨투어: '야'(상승) → '옹'(하강)
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.14); // 야↗
    osc.frequency.setValueAtTime(760, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(340, now + dur);  // 옹↘

    // 비브라토 — 고양이 특유의 떨림
    const vib = c.createOscillator();
    vib.frequency.value = 24;
    const vibGain = c.createGain();
    vibGain.gain.value = 22;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    // 비음 포먼트 — 밴드패스로 '냐옹' 콧소리
    const formant = c.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(1300, now);
    formant.frequency.exponentialRampToValueAtTime(700, now + dur);
    formant.Q.value = 2.2;

    // 톱니파의 날카로움 제거
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.05);
    gain.gain.setValueAtTime(0.22, now + 0.16);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.24);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(formant);
    formant.connect(lp);
    lp.connect(gain);
    gain.connect(getSfxOutput(c));
    osc.start(now); osc.stop(now + dur + 0.02);
    vib.start(now); vib.stop(now + dur + 0.02);
  } catch {}
}

/** 밴 삭제 내 차례 알림음 — 부드러운 2음 상승 */
export function playUnbanTurnStartSfx() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    const playTone = (freq: number, delay: number, dur: number, vol: number) => {
      const t0 = now + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain); gain.connect(getSfxOutput(c));
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    };

    playTone(659, 0, 0.2, 0.07);
    playTone(880, 0.14, 0.25, 0.06);
  } catch {}
}
