import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GAME_IDS } from '@shared/types/game.js';
import {
  displayGameName,
  filterUnreleased,
  isUnreleasedGame,
  UNRELEASED_GAME_IDS,
} from '../../../lib/unreleasedGames';
import { getGameRule } from '../../../lib/gameRules';
import { gameModules } from '../socket/game.js';

const games = [
  { id: GAME_IDS.NO_VOWEL, name: '모음이 없어요' },
  { id: GAME_IDS.LOOP_CHECK, name: '루프체크' },
  { id: GAME_IDS.FAREWELL_FORMULA, name: '이별 공식' },
  { id: GAME_IDS.FORMULA_COMPLETION, name: '수식완성N' },
];
/** 출시 전 게임 (2026-11-01 기준) */
const unreleased = [
  { id: GAME_IDS.SQUARE_MOK, name: '사각목' },
  { id: GAME_IDS.JOGAK, name: '조각조각' },
];

describe('신규 게임 출시 전 배포', () => {
  it('운영 게임 ID와 겹치지 않고 세 게임의 서버 모듈을 유지한다', () => {
    expect(new Set(Object.values(GAME_IDS)).size).toBe(Object.values(GAME_IDS).length);
    expect(GAME_IDS.NO_VOWEL).toBe('game-031');
    expect(GAME_IDS.LOOP_CHECK).toBe('game-032');
    expect(GAME_IDS.FAREWELL_FORMULA).toBe('game-033');
    for (const game of games.slice(0, 3)) expect(gameModules[game.id]?.init).toBeTypeOf('function');
  });

  it('출시한 세 게임은 일반 사용자에게 보이고, 출시 전 게임만 감춘다', () => {
    expect(new Set(UNRELEASED_GAME_IDS).size).toBe(UNRELEASED_GAME_IDS.length);
    expect(filterUnreleased([...games, ...unreleased], false)).toEqual(games);
    for (const game of games) {
      expect(isUnreleasedGame(game.id)).toBe(false);
      expect(displayGameName(game.id, game.name, false)).toBe(game.name);
    }
    for (const game of unreleased) {
      expect(isUnreleasedGame(game.id)).toBe(true);
      expect(displayGameName(game.id, game.name, false)).toBe('신규 게임');
    }
  });

  it('관리자는 실제 게임 이름과 전체 목록을 확인한다', () => {
    expect(filterUnreleased([...games, ...unreleased], true)).toEqual([...games, ...unreleased]);
    for (const game of [...games, ...unreleased]) expect(displayGameName(game.id, game.name, true)).toBe(game.name);
    expect(displayGameName(GAME_IDS.FORMULA_COMPLETION, '수식완성N', false)).toBe('수식완성N');
  });

  it('게임 분류와 등록 SQL에도 서로 다른 ID를 사용한다', () => {
    expect(getGameRule(GAME_IDS.LOOP_CHECK)?.category).toBe('관찰');
    expect(getGameRule(GAME_IDS.FAREWELL_FORMULA)?.category).toBe('수리');
    for (const [slug, id] of [
      ['loop_check', GAME_IDS.LOOP_CHECK],
      ['farewell_formula', GAME_IDS.FAREWELL_FORMULA],
    ]) {
      const sql = readFileSync(new URL(`../../../db/${slug}_game.sql`, import.meta.url), 'utf8');
      expect(sql).toMatch(new RegExp(`values\\s*\\(\\s*'${id}'`, 'i'));
    }
  });
});
