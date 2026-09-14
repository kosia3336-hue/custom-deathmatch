import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import { quatroCardById, type QuatroCard } from '@shared/types/quatro.js';
import {
  quatroAdvisorAsk,
  quatroAdvisorSnapshot,
  quatroParseAdvisorPly,
  type QuatroAdvisorPly,
} from '@shared/types/quatro-advisor.js';
import {
  parseAdvisorHistory,
  pickQuatroAdvisor,
  quatroAdvisorCandidates,
} from '../socket/games/quatro/ai-super.js';

function card(id: string): QuatroCard {
  const c = quatroCardById(id);
  if (!c) throw new Error(id);
  return c;
}

const QUATRO_HAND: QuatroCard[] = [
  card('spade-6'),
  card('heart-5'),
  card('diamond-4'),
  card('club-3'),
];
const TWO_BLACK: QuatroCard[] = [
  card('black-0-a'),
  card('black-0-b'),
  card('spade-1'),
  card('heart-1'),
];
const R1_HAND: QuatroCard[] = [
  card('spade-6'),
  card('heart-6'),
  card('club-2'),
  card('diamond-5'),
];

function skipMulligan(hand: QuatroCard[]): QuatroAdvisorPly[] {
  return [
    { kind: 'deal', myHand: hand },
    { kind: 'mulligan', by: 'me', use: false },
    { kind: 'mulligan', by: 'opp', use: false },
  ];
}

describe('콰트로 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.QUATRO)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.QUATRO)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.QUATRO)).toBe('/super-ai/quatro');
  });

  it('스냅샷·히스토리에 상대 미오픈 손·VP 전체 패가 없다', () => {
    const hist = skipMulligan(R1_HAND);
    const snap = quatroAdvisorSnapshot(true, hist);
    expect(snap.result.kind).toBe('playing');
    expect(snap.phase).toBe('open');
    expect('hand' in snap.opp).toBe(false);
    expect(snap.vps.every((vp) => !('cards' in vp))).toBe(true);
    expect(JSON.stringify(snap)).not.toMatch(/oppHand/);
    expect(quatroParseAdvisorPly({
      kind: 'deal',
      myHand: R1_HAND,
      oppHand: QUATRO_HAND,
    })).toBeNull();
    expect(quatroParseAdvisorPly({
      kind: 'open',
      by: 'me',
      card: card('spade-6'),
      cards: [card('club-1')],
    })).toBeNull();
    expect(parseAdvisorHistory([{
      kind: 'exchange',
      by: 'opp',
      vpIndex: 0,
      gave: card('club-4'),
      received: card('heart-1'),
    }], true)).toBeNull();
  });

  it('콰트로면 멀리건하지 않고, 검정0 2장이면 한다', () => {
    const qHist: QuatroAdvisorPly[] = [{ kind: 'deal', myHand: QUATRO_HAND }];
    expect(quatroAdvisorAsk(true, qHist)).toBe('mulligan');
    const qPick = pickQuatroAdvisor(true, qHist, 200);
    expect(qPick.action).toEqual({ type: 'mulligan', use: false });

    const bHist: QuatroAdvisorPly[] = [{ kind: 'deal', myHand: TWO_BLACK }];
    const bPick = pickQuatroAdvisor(true, bHist, 200);
    expect(bPick.action).toEqual({ type: 'mulligan', use: true });
  });

  it('R1 오픈은 높은 키퍼(6)를 잠근다', () => {
    const hist = skipMulligan(R1_HAND);
    expect(quatroAdvisorAsk(true, hist)).toBe('open');
    const pick = pickQuatroAdvisor(true, hist, 200);
    expect(pick.action.type).toBe('open');
    if (pick.action.type === 'open') {
      const opened = R1_HAND.find((c) => c.id === pick.action.cardId);
      expect(opened?.num).toBe(6);
    }
  });

  it('초반 교환은 스탑이 기본, 마지막 페이즈는 스탑 불가', () => {
    const early: QuatroAdvisorPly[] = [
      ...skipMulligan(R1_HAND),
      { kind: 'open', by: 'me', card: card('spade-6') },
      { kind: 'open', by: 'opp', card: card('club-4') },
    ];
    expect(quatroAdvisorAsk(true, early)).toBe('exchange');
    const earlySnap = quatroAdvisorSnapshot(true, early);
    expect(earlySnap.round).toBe(1);
    expect(quatroAdvisorCandidates(earlySnap).some((a) => a.type === 'stop')).toBe(true);
    const earlyPick = pickQuatroAdvisor(true, early, 200);
    expect(earlyPick.action.type).toBe('stop');

    const last: QuatroAdvisorPly[] = [
      ...early,
      { kind: 'stop', by: 'me' },
      { kind: 'stop', by: 'opp' },
      { kind: 'open', by: 'me', card: card('diamond-5') },
      { kind: 'open', by: 'opp', card: card('heart-3') },
      { kind: 'stop', by: 'opp' },
      { kind: 'stop', by: 'me' },
      { kind: 'open', by: 'me', card: card('heart-6') },
      { kind: 'open', by: 'opp', card: card('spade-1') },
    ];
    expect(parseAdvisorHistory(last, true)).not.toBeNull();
    const lastSnap = quatroAdvisorSnapshot(true, last);
    expect(lastSnap.phase).toBe('exchange');
    expect(lastSnap.round).toBe(3);
    expect(quatroAdvisorCandidates(lastSnap).every((a) => a.type !== 'stop')).toBe(true);
    expect(quatroAdvisorCandidates(lastSnap).some((a) => a.type === 'exchange')).toBe(true);
    const lastPick = pickQuatroAdvisor(true, last, 200);
    expect(lastPick.action.type).toBe('exchange');
  });
});
