'use client';

import { opponentDisplayName } from '@/lib/anonymousOpponents';
import type { BNW2Color, BNW2PlayerInfo, BNW2RevealData } from '@/shared/types/bnw2';

interface Props {
  revealData: BNW2RevealData;
  players: Record<string, BNW2PlayerInfo>;
  myId: string;
  firstPlayerId: string;
  step: number;
}

function ColorBadge({ color, visible }: { color: BNW2Color; visible: boolean }) {
  return (
    <span
      className={`inline-flex h-8 items-center rounded-md px-3 text-sm font-bold tracking-wide transition-all duration-500 ${
        visible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
      } ${color === 'black' ? 'bg-slate-800 text-slate-100' : 'border border-gray-300 bg-white text-slate-800'}`}
    >
      {color === 'black' ? '■ 흑' : '□ 백'}
    </span>
  );
}

/** 모자 없는 총잡이 실루엣 (모자는 별도 엘리먼트로 얹어 총 맞으면 날아가게 함) */
function Cowboy() {
  return (
    <svg viewBox="0 0 120 160" className="skin-showdown-cowboy-svg" aria-hidden>
      <g fill="currentColor">
        <circle cx="60" cy="30" r="9" />
        <rect x="55" y="36" width="10" height="9" rx="2" />
        <path d="M38 50 C47 43 73 43 82 50 L88 112 C82 117 72 118 60 118 C48 118 38 117 32 112 Z" />
        <path d="M39 54 L28 96 L36 99 L47 58 Z" />
        <path d="M81 54 L92 92 L84 96 L73 58 Z" />
        <path d="M86 90 L104 88 L104 93 L90 96 Z" />
        <path d="M45 108 L41 158 L54 158 L58 112 Z" />
        <path d="M62 112 L66 158 L79 158 L75 108 Z" />
      </g>
    </svg>
  );
}

function CowboyHat() {
  return (
    <svg viewBox="0 0 90 42" className="skin-showdown-cowboy-hat" aria-hidden>
      <g fill="currentColor">
        <ellipse cx="45" cy="32" rx="43" ry="7" />
        <path d="M26 32 C24 11 34 5 45 5 C56 5 66 11 64 32 Z" />
      </g>
    </svg>
  );
}

type DuelOutcome = 'idle' | 'win' | 'lose' | 'draw';
type Side = 'left' | 'right';

function DuelFigure({ side, outcome }: { side: Side; outcome: DuelOutcome }) {
  return (
    <div
      className={`skin-showdown-duel-figure skin-showdown-duel-figure--${side === 'left' ? 'me' : 'opp'}`}
    >
      <div className={`skin-showdown-duel-body skin-showdown-duel-body--${outcome}`}>
        <div
          className={`skin-showdown-duel-body-inner${side === 'right' ? 'skin-showdown-duel-body-inner--flip' : ''}`}
        >
          {outcome === 'win' && <span className="skin-showdown-duel-flash" />}
          <Cowboy />
        </div>
      </div>
      <div
        className={`skin-showdown-duel-hat skin-showdown-duel-hat--${outcome}${side === 'right' ? 'skin-showdown-duel-hat--flip' : ''}`}
      >
        <CowboyHat />
      </div>
    </div>
  );
}

/**
 * 결투 실루엣 컷씬 — 결과 공개(step>=3) 순간 승자는 총을 쏘고(머즐 플래시),
 * 패자는 모자가 날아가며 뒤로 쓰러진다. 무승부면 둘 다 그대로 선다.
 */
function DuelScene({
  leftId,
  rightId,
  winnerId,
  step,
}: {
  leftId: string;
  rightId: string;
  winnerId: string | null;
  step: number;
}) {
  const revealed = step >= 3;
  const outcomeOf = (id: string): DuelOutcome => {
    if (!revealed) return 'idle';
    if (winnerId === null) return 'draw';
    return winnerId === id ? 'win' : 'lose';
  };
  return (
    <div className="skin-showdown-duel" aria-hidden>
      <span className="skin-showdown-duel-sun" />
      <DuelFigure side="left" outcome={outcomeOf(leftId)} />
      <DuelFigure side="right" outcome={outcomeOf(rightId)} />
      <div className="skin-showdown-duel-ground" />
      {revealed && winnerId === null && (
        <span className="skin-showdown-duel-draw-label">무승부</span>
      )}
    </div>
  );
}

/** 라운드 결과 — 결투 실루엣 컷씬 + 색/점수 단계 공개 (숫자 제시값은 끝까지 비공개) */
export default function ShowdownRevealPanel({
  revealData,
  players,
  myId,
  firstPlayerId,
  step,
}: Props) {
  const entries = Object.entries(revealData.players);
  const winnerId = revealData.winnerId;

  // 결투 배치는 트랙과 동일하게 좌=나(관전자는 첫 참가자), 우=상대
  const leftId = entries.some(([id]) => id === myId) ? myId : (entries[0]?.[0] ?? '');
  /* 내가 플레이어 목록에 없으면 관전자다. 관전석은 두 사람 다 익명일 수 있어 '상대' 로 부르지 않는다. */
  const isSpectator = !players[myId];
  const rightId = entries.find(([id]) => id !== leftId)?.[0] ?? '';

  /*
    아래 점수 카드도 결투와 같은 좌우로 맞춘다.
    예전에는 선플·후플 순서로 깔아서, 내가 후플이면 결투에서는 오른쪽(상대)이
    총을 쏘는데 승자 카드는 왼쪽에 켜졌다 — 같은 패널 안에서 좌우가 서로 달라
    '엉뚱한 쪽이 쏜다'로 읽혔다. 색 공개 순서만 선플이 먼저이므로 그건 자리
    순서가 아니라 firstPlayerId 로 판정한다.
  */
  const ordered = [leftId, rightId]
    .filter((id) => revealData.players[id])
    .map((id) => [id, revealData.players[id]] as [string, BNW2RevealData['players'][string]]);

  return (
    <div className="w-full space-y-3 rounded-xl border border-amber-200/70 bg-white/85 p-4 backdrop-blur-sm">
      <p className="text-center text-sm font-semibold text-amber-900">라운드 결과</p>

      <DuelScene leftId={leftId} rightId={rightId} winnerId={winnerId} step={step} />

      <div className="grid grid-cols-2 gap-3">
        {ordered.map(([pid, pd]) => {
          const pInfo = players[pid];
          const isMe = pid === myId;
          const isWinner = pid === winnerId;
          const colorVisible = pid === firstPlayerId ? step >= 1 : step >= 2;
          const winnerVisible = step >= 3;
          const stagesConsumed = pd.stageBefore - Math.max(pd.stageAfter, 1);

          return (
            <div
              key={pid}
              className={`rounded-xl border p-3 text-center transition-all duration-300 ${
                winnerVisible && isWinner
                  ? 'border-emerald-300 bg-emerald-50 shadow-[0_0_8px_rgba(52,211,153,0.2)]'
                  : winnerVisible && winnerId !== null
                    ? 'border-gray-200 bg-gray-50 opacity-60'
                    : winnerVisible && winnerId === null
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-gray-200 bg-gray-50'
              }`}
            >
              {/*
                이름을 못 찾을 때 pid(플레이어 토큰)를 그대로 찍고 있었다.
                식별자를 화면에 내보이는 셈이라 '상대' 로 둔다. 랭크에서 서버가
                '???' 로 내려 주면 opponentDisplayName 이 '상대' 로 읽어 준다.
              */}
              <p className="truncate text-xs font-medium text-gray-500">
                {isMe ? '나' : opponentDisplayName(pInfo?.nickname, isSpectator)}
              </p>
              <div className="my-2 flex justify-center">
                <ColorBadge color={pd.color} visible={colorVisible} />
              </div>
              {colorVisible && (
                <p className="text-xs font-medium text-indigo-500">
                  {stagesConsumed > 0
                    ? `불이 ${stagesConsumed}칸 꺼집니다.`
                    : '불이 꺼지지 않습니다.'}
                </p>
              )}
              {winnerVisible && pd.scoreChange > 0 && (
                <p className="text-xs font-semibold text-emerald-600">+{pd.scoreChange}점</p>
              )}
              {winnerVisible && (
                <p className="text-xs text-gray-400">
                  {pd.scoreBefore} → {pd.scoreAfter}점
                </p>
              )}
            </div>
          );
        })}
      </div>

      {step >= 3 && winnerId === null && (
        <p className="text-center text-sm font-semibold text-amber-500">무승부</p>
      )}
    </div>
  );
}
