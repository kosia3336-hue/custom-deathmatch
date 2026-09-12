'use client';

import { useState, useSyncExternalStore } from 'react';
import { Icon } from '@/components/cdm/Icon';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/**
 * 인터넷 연결이 끊겼을 때의 안내 — 앱처럼 화면 위에 창으로 띄운다.
 *
 * 앱(웹뷰)은 이 사이트를 그대로 띄우는 구조라, 연결이 끊긴 채 화면을 누르면
 * 브라우저 기본 오류 화면이나 페이지 오류가 그대로 드러났다. 연결이 돌아오면
 * 창은 저절로 닫히고 소켓은 스스로 다시 붙는다.
 *
 * 첫 화면조차 못 불러온 경우(앱을 오프라인에서 켰을 때)는 이 번들이 없으므로
 * 앱 셸의 로컬 페이지(mobile/www/offline.html)가 맡는다.
 */
export default function OfflineOverlay() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const [stillOffline, setStillOffline] = useState(false);

  if (online) return null;

  const retry = () => {
    if (navigator.onLine) {
      window.location.reload();
      return;
    }
    setStillOffline(true);
    window.setTimeout(() => setStillOffline(false), 2500);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      aria-describedby="offline-desc"
      className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center sm:items-center"
    >
      <div aria-hidden className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-sm rounded-t-cdm-xl border border-cdm-ink-border bg-cdm-ink px-6 pt-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-cdm-ink-fg shadow-2xl sm:rounded-cdm-xl sm:pb-6">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/12">
          <Icon name="wifiOff" size="lg" className="size-8 text-cdm-highlight" />
        </div>
        <h2 id="offline-title" className="mt-4 text-lg font-extrabold tracking-tight text-white">
          인터넷 연결이 끊겼어요
        </h2>
        <p id="offline-desc" className="mt-1.5 text-sm leading-relaxed text-cdm-ink-fg-muted">
          연결이 돌아오면 자동으로 이어집니다.
          <br />
          진행 중인 판은 30초 안에 돌아오면 이어서 할 수 있어요.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 h-12 w-full rounded-cdm-md bg-cdm-primary text-[15px] font-bold text-white"
        >
          다시 시도
        </button>
        <p role="status" className="mt-2 min-h-4 text-xs text-cdm-ink-fg-muted">
          {stillOffline ? '아직 연결되지 않았어요. 연결되면 창이 저절로 닫힙니다.' : ''}
        </p>
      </div>
    </div>
  );
}
