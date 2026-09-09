import { describe, expect, it } from 'vitest';
import { GAME_IDS } from '../../../shared/types/game';
import type { GameState } from '../../../shared/types/events';
import { GAME_PROGRESS, getGameClock, getGameProgress, getGameStatus } from '../../../lib/gameProgress';

const state = (gameData: unknown): GameState => ({
  roomId: 'test',
  message: '',
  currentTurn: null,
  turnNumber: 8,
  startedAt: 1000,
  turnStartedAt: 5000,
  gameData,
});

describe('공통 게임 상단 바', () => {
  it('등록된 모든 게임의 진행 단위를 명시한다', () => {
    expect(Object.keys(GAME_PROGRESS).sort()).toEqual(Object.values(GAME_IDS).sort());
  });
  it('제한 없는 카드 라운드와 총 라운드, 보드 턴을 구분한다', () => {
    expect(getGameProgress(GAME_IDS.SEED_SEOTDA, state({ round: 12 }))).toBe('12R');
    expect(getGameProgress(GAME_IDS.KNIGHTS_TOUR, state({ round: 4, totalRounds: 7 }))).toBe(
      '4 / 7R',
    );
    expect(getGameProgress(GAME_IDS.BANK_GAME, state({ round: 3, maxRound: 10 }))).toBe('3 / 10R');
    expect(getGameProgress(GAME_IDS.FOUR_GRAVITY, state({}))).toBe('8턴');
  });
  it('개별 HUD가 없는 게임도 현재 진행 단계를 상단 바 문구로 만든다', () => {
    expect(getGameStatus(state({ phase: 'betting', currentTurnId: 'me' }), 'me')).toBe('내 차례');
    expect(getGameStatus(state({ phase: 'betting', currentTurnId: 'other' }), 'me')).toBe('상대 차례');
    expect(getGameStatus(state({ phase: 'reveal' }), 'me')).toBe('공개');
    expect(getGameStatus(state({ phase: 'finished' }), 'me')).toBe('종료');
  });
  it('COM 나이트의 여행은 방 설정 대신 실제 60초를 사용하고 결과 중에는 멈춘다', () => {
    const data = { phase: 'playing', roundSeconds: 60, roundStartedAt: 3000 };
    expect(getGameClock(GAME_IDS.KNIGHTS_TOUR, state(data), null)).toEqual({
      timeLimitSeconds: 60,
      turnStartedAt: 3000,
    });
    expect(
      getGameClock(GAME_IDS.KNIGHTS_TOUR, state({ ...data, phase: 'round-result' }), 300)
        .turnStartedAt,
    ).toBeNull();
  });
  it('결합은 라운드가 바뀌어도 전체 경기의 마감 시각을 유지한다', () => {
    expect(
      getGameClock(
        GAME_IDS.COMPLETE_HAP,
        state({ phase: 'playing', matchSeconds: 600, matchStartedAt: 1000, roundStartedAt: 40000 }),
        60,
      ),
    ).toEqual({ timeLimitSeconds: 600, turnStartedAt: 1000 });
  });
  it('무제한 값과 베팅 종료의 null 시작 시각을 보존한다', () => {
    expect(
      getGameClock(
        GAME_IDS.FORMULA_COMPLETION,
        state({ phase: 'playing', roundSeconds: null, roundStartedAt: 3000 }),
        60,
      ).timeLimitSeconds,
    ).toBeNull();
    expect(
      getGameClock(GAME_IDS.SEED_SEOTDA, state({ turnSeconds: 30, turnStartedAt: null }), 60),
    ).toEqual({ timeLimitSeconds: 30, turnStartedAt: null });
  });
});
