'use client';

import PhaseTransitionOverlay from './PhaseTransitionOverlay';
import MobileLayout from './MobileLayout';
import DesktopLayout from './DesktopLayout';
import { useBankContext } from './hooks/useBankContext';

/* ════════════════════════════════════════════════════════════
 * 은행놀이 — 메인 게임 컴포넌트 (얇은 컨테이너)
 *   · useBankContext 가 모든 상태/액션/파생값을 한 객체로 묶어 반환
 *   · MobileLayout (≤ 1023px) / DesktopLayout (≥ 1024px) 를
 *     각각 lg:hidden / hidden lg:flex 로 분기 마운트
 *   · 두 레이아웃은 완전히 별개 파일로 분리 — 한쪽 수정이 반대편 영향 X
 *   · PhaseTransitionOverlay / 키프레임 스타일 만 공통 마운트
 * ════════════════════════════════════════════════════════════ */

export default function BankGame() {
  const ctx = useBankContext();
  const {
    gameData,
    isSpectator,
    phase,
    stepperActiveTurn,
    firstPlayer,
    secondPlayer,
    myIsFirst,
  } = ctx;

  if (!gameData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes bankFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bankSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bankBannerPop {
          0%   { transform: scale(0.96); opacity: 0; }
          60%  { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes bankStepPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.5); }
          50%      { transform: scale(1.06); box-shadow: 0 0 0 6px rgba(251, 191, 36, 0); }
        }
        @keyframes bankSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes bankAmountReveal {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes bankResultPop {
          0%   { transform: scale(0.7); opacity: 0; }
          65%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
      `}</style>

      <PhaseTransitionOverlay
        phase={phase ?? 'firstSubmit'}
        isMyTurn={stepperActiveTurn}
        isSpectator={isSpectator}
        firstNick={firstPlayer?.nickname ?? ''}
        secondNick={secondPlayer?.nickname ?? ''}
        myIsFirst={myIsFirst}
      />

      {/* 모바일 (≤ 1023px) */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-x-hidden lg:hidden">
        <MobileLayout ctx={ctx} />
      </div>

      {/* 데스크탑 (≥ 1024px) */}
      <div className="hidden h-full min-w-0 flex-1 lg:flex lg:flex-col">
        <DesktopLayout ctx={ctx} />
      </div>
    </>
  );
}
