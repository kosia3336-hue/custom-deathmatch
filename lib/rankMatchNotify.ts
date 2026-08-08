/**
 * 랭크 매칭 성사 알림.
 *
 * 매칭은 탭이 뒤에 있을 때 잡히는 경우가 많다(다른 탭을 보거나 폰을 잠깐 내려둔 사이).
 * 화면 안의 오버레이만으로는 놓치기 쉬워서, 브라우저 알림과 소리로도 알린다.
 *
 * 주의: 알림 권한은 사용자 제스처 안에서 요청해야 한다. 그래서 권한 요청은
 * '랭크 시작' 버튼을 누르는 시점(requestRankNotifyPermission)에 하고,
 * 실제 알림은 매칭 시점(notifyRankMatched)에 띄운다.
 */

const STORAGE_KEY = 'rankNotifyDenied';

function notificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** 사용자가 한 번 거부했으면 다시 조르지 않는다. */
function userRefusedBefore(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberRefusal(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* 시크릿 모드 등 — 무시 */
  }
}

/**
 * 랭크 큐 진입 시 호출. 사용자 제스처 안에서 실행되어야 권한 창이 뜬다.
 * 권한이 없어도 큐 진입 자체는 막지 않는다 — 실패는 조용히 삼킨다.
 */
export async function requestRankNotifyPermission(): Promise<void> {
  if (!notificationSupported()) return;
  if (Notification.permission !== 'default') return;
  if (userRefusedBefore()) return;

  try {
    const result = await Notification.requestPermission();
    if (result === 'denied') rememberRefusal();
  } catch {
    /* 일부 브라우저는 거부 시 throw — 무시 */
  }
}

/** 매칭 성사 알림. 탭이 보이는 상태면 화면 오버레이로 충분하므로 띄우지 않는다. */
export function notifyRankMatched(opponentNickname: string): void {
  playChime();

  if (!notificationSupported() || Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

  try {
    const notification = new Notification('랭크 매칭 성사', {
      body: `${opponentNickname} 님과 매칭됐습니다. 돌아와서 게임을 시작하세요.`,
      // 같은 tag 를 쓰면 알림이 쌓이지 않고 최신 것으로 교체된다
      tag: 'rank-matched',
      requireInteraction: true,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    /* 일부 모바일 브라우저는 ServiceWorker 없이 생성 시 throw — 소리로 대체 */
  }
}

/**
 * 짧은 알림음. 오디오 파일을 하나 더 받게 하지 않으려고 WebAudio 로 만든다.
 * 탭이 백그라운드면 브라우저가 오디오를 막을 수 있는데, 그때는 조용히 실패한다.
 */
function playChime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const now = ctx.currentTime;
    // 두 음(솔 → 도)을 짧게 이어 붙인 상승음
    [
      { freq: 784, at: 0, dur: 0.16 },
      { freq: 1047, at: 0.15, dur: 0.28 },
    ].forEach(({ freq, at, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.25, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + dur);
    });

    setTimeout(() => void ctx.close().catch(() => {}), 800);
  } catch {
    /* 오디오 정책으로 막히면 무시 */
  }
}
