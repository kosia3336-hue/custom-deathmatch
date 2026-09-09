'use client';

import { useState } from 'react';
import Script from 'next/script';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { resultShareTemplate, resultShareText, type ResultShareSummary } from '@/lib/resultShare';

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    sendDefault: (payload: ReturnType<typeof resultShareTemplate>) => void | Promise<unknown>;
  };
};
function sdk() {
  return (window as Window & { Kakao?: KakaoSdk }).Kakao;
}

export default function KakaoResultShareButton({ summary }: { summary: ResultShareSummary }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
  const initialize = () => {
    try {
      const kakao = sdk();
      if (!kakao || !key) return;
      if (!kakao.isInitialized()) kakao.init(key);
      setReady(true);
    } catch {
      setMessage('카카오톡 공유 설정을 확인해 주세요.');
    }
  };
  const share = () => {
    try {
      const kakao = sdk();
      if (!kakao || !ready) return;
      const payload = resultShareTemplate(
        summary,
        process.env.NEXT_PUBLIC_SITE_URL || window.location.origin,
      );
      // 사용자 클릭 안에서 즉시 호출해야 브라우저 팝업 차단을 피할 수 있다.
      const sent = kakao.Share.sendDefault(payload);
      if (sent && typeof sent.catch === 'function')
        void sent.catch(() =>
          setMessage('공유창을 열지 못했습니다. 팝업 허용 및 카카오 설정을 확인해 주세요.'),
        );
    } catch {
      setMessage('공유창을 열지 못했습니다. 팝업 허용 및 카카오 설정을 확인해 주세요.');
    }
  };
  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setMessage('');
          setOpen(true);
        }}
      >
        카카오톡 공유
      </Button>
      {open && key && (
        <Script
          id="kakao-share-sdk"
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js"
          integrity="sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy"
          strategy="afterInteractive"
          crossOrigin="anonymous"
          onReady={initialize}
          onError={() =>
            setMessage('카카오 SDK를 불러오지 못했습니다. 페이지를 새로고침해 주세요.')
          }
        />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="전적 공유">
        <p className="text-cdm-fg text-sm leading-relaxed whitespace-pre-line">
          {resultShareText(summary)}
        </p>
        <p className="text-cdm-fg-muted mt-3 text-xs">
          결과 요약만 공유합니다. 상세 로그·비공개 패·닉네임은 공개하지 않으며 링크는 로비로
          연결됩니다.
        </p>
        {!key && (
          <p className="text-cdm-fg-muted mt-3 text-sm">
            카카오톡 공유 연동을 준비 중입니다. 지금은 결과 요약을 복사할 수 있습니다.
          </p>
        )}
        {message && (
          <p role="status" className="text-cdm-fg mt-3 text-sm">
            {message}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          {key && (
            <Button disabled={!ready} onClick={share}>
              {ready ? '카카오톡으로 공유' : '공유 준비 중…'}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(resultShareText(summary));
                setMessage('결과 요약을 복사했습니다.');
              } catch {
                setMessage('복사하지 못했습니다. 위 결과를 직접 선택해 복사해 주세요.');
              }
            }}
          >
            결과 요약 복사
          </Button>
        </div>
      </Modal>
    </>
  );
}
