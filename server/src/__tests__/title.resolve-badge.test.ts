import { describe, expect, it } from 'vitest';
import {
  composeDisplayedTitle,
  isTitleEffectKey,
  isOverlayApplied,
  isUnexpiredGrant,
  resolveBadge,
  type ResolveTitleInput,
} from '@shared/titles/resolve-badge.js';

const normal: ResolveTitleInput = {
  name: '수집가',
  color: 'lime',
  is_legend: false,
  effect: null,
};

const xuanwu: ResolveTitleInput = {
  name: '영겁의 현무',
  color: 'charcoal',
  is_legend: true,
  effect: 'xuanwu',
};

const jujak: ResolveTitleInput = {
  name: '홍련의 주작',
  color: 'red',
  is_legend: true,
  effect: 'jujak',
};

const immortalTitle: ResolveTitleInput = {
  name: '불멸의 정점',
  color: 'gold',
  is_legend: true,
  effect: 'legend',
};

describe('resolveBadge', () => {
  it('칭호가 없으면 뱃지 없음', () => {
    expect(resolveBadge(null, { key: 'legend' })).toBeNull();
  });

  it('일반 칭호 + 이펙트 → overlay', () => {
    expect(resolveBadge(normal, { key: 'legend' })).toEqual({
      name: '수집가',
      color: 'lime',
      effect: 'legend',
    });
    expect(isOverlayApplied(normal, { key: 'legend' })).toBe(true);
  });

  it('일반 칭호 + 이펙트 없음 → 고유 effect(보통 null)', () => {
    expect(resolveBadge(normal, null)).toEqual({
      name: '수집가',
      color: 'lime',
      effect: null,
    });
    expect(isOverlayApplied(normal, null)).toBe(false);
  });

  it('사방신(현무)은 장착 이펙트를 무시한다', () => {
    expect(resolveBadge(xuanwu, { key: 'issen' })).toEqual({
      name: '영겁의 현무',
      color: 'charcoal',
      effect: 'xuanwu',
    });
    expect(isOverlayApplied(xuanwu, { key: 'issen' })).toBe(false);
  });

  it('사방신(주작)은 고유 화염 효과를 유지한다', () => {
    expect(resolveBadge(jujak, { key: 'frost' })).toEqual({
      name: '홍련의 주작',
      color: 'red',
      effect: 'jujak',
    });
    expect(isOverlayApplied(jujak, { key: 'frost' })).toBe(false);
    expect(isTitleEffectKey('jujak')).toBe(true);
  });

  it('시즌 레전드 칭호도 is_legend 이면 overlay 불가', () => {
    expect(resolveBadge(immortalTitle, { key: 'issen' })).toEqual({
      name: '불멸의 정점',
      color: 'gold',
      effect: 'legend',
    });
    expect(isOverlayApplied(immortalTitle, { key: 'issen' })).toBe(false);
  });

  it('일반 칭호 + 일섬 overlay', () => {
    expect(resolveBadge(normal, { key: 'issen' })).toEqual({
      name: '수집가',
      color: 'lime',
      effect: 'issen',
    });
  });

  it('일반 칭호 + 별빛 overlay', () => {
    expect(resolveBadge(normal, { key: 'seongha' })).toEqual({
      name: '수집가',
      color: 'lime',
      effect: 'seongha',
    });
  });

  it('일반 칭호 + 벚꽃 overlay', () => {
    expect(resolveBadge(normal, { key: 'sakura' })).toEqual({
      name: '수집가',
      color: 'lime',
      effect: 'sakura',
    });
  });

  it('일반 칭호 + 수정서리 overlay', () => {
    expect(resolveBadge(normal, { key: 'frost' })).toEqual({
      name: '수집가',
      color: 'lime',
      effect: 'frost',
    });
  });

  it('일반 칭호 + 라이트닝 overlay', () => {
    expect(resolveBadge(normal, { key: 'lightning' })).toEqual({
      name: '수집가',
      color: 'lime',
      effect: 'lightning',
    });
  });

  it('일반 칭호 + 파도풀 overlay', () => {
    expect(resolveBadge(normal, { key: 'wave' })).toEqual({
      name: '수집가',
      color: 'lime',
      effect: 'wave',
    });
  });

  it('일반 칭호 + 도장 overlay', () => {
    expect(resolveBadge(normal, { key: 'dojang' })).toEqual({
      name: '수집가',
      color: 'lime',
      effect: 'dojang',
    });
  });

  it('composeDisplayedTitle 는 id 를 유지하고 effect 만 합성한다', () => {
    expect(
      composeDisplayedTitle({ id: 't1', ...normal }, { key: 'issen' }),
    ).toEqual({
      id: 't1',
      name: '수집가',
      color: 'lime',
      effect: 'issen',
    });
    expect(composeDisplayedTitle({ id: 'x1', ...xuanwu }, { key: 'issen' })?.effect).toBe(
      'xuanwu',
    );
  });
});

describe('isUnexpiredGrant', () => {
  const now = Date.parse('2026-08-16T00:00:00.000Z');

  it('NULL 은 영구', () => {
    expect(isUnexpiredGrant(null, now)).toBe(true);
    expect(isUnexpiredGrant(undefined, now)).toBe(true);
  });

  it('미래 시각은 유효', () => {
    expect(isUnexpiredGrant('2026-08-17T00:00:00.000Z', now)).toBe(true);
  });

  it('지난 시각은 만료', () => {
    expect(isUnexpiredGrant('2026-08-15T23:59:59.000Z', now)).toBe(false);
  });
});
