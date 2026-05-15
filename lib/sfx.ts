let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
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
    gain.connect(c.destination);
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
    osc.connect(oGain); oGain.connect(c.destination);
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
    src.connect(lp); lp.connect(nGain); nGain.connect(c.destination);
    src.start(now); src.stop(now + 0.12);

    // 고음 링 (밝은 느낌)
    const osc2 = c.createOscillator();
    const oGain2 = c.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1400, now);
    osc2.frequency.exponentialRampToValueAtTime(700, now + 0.09);
    oGain2.gain.setValueAtTime(0.18, now);
    oGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc2.connect(oGain2); oGain2.connect(c.destination);
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
    g1.connect(c.destination);
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
    g2.connect(c.destination);
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
      gain.connect(c.destination);
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
    osc1.connect(g1); g1.connect(c.destination);
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
    osc2.connect(g2); g2.connect(c.destination);
    osc2.start(now); osc2.stop(now + 0.2);

    // Layer 3: 잔향 (사인파 1800Hz, gain 0.06, 0.3s)
    const osc3 = c.createOscillator();
    const g3 = c.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1800, now);
    g3.gain.setValueAtTime(0.06, now);
    g3.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc3.connect(g3); g3.connect(c.destination);
    osc3.start(now); osc3.stop(now + 0.3);
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
      osc.connect(gain); gain.connect(c.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    };

    playTone(659, 0, 0.2, 0.07);
    playTone(880, 0.14, 0.25, 0.06);
  } catch {}
}
