import { describe, expect, it } from 'vitest';
import { DRAGON_LIMBS, articulateDragonLimb, articulateDragonWhisker, hasDragonLimb } from '../../../components/cdm/title-effects/cheongryong-articulation';
import { DRAGON_ROUTE, DRAGON_VIEW } from '../../../components/cdm/title-effects/cheongryong-path';

describe('청룡 밀착 경로/부속 동작', () => {
  it('중심은 유지하고 좌우 경로를 명패 폭 가까이 줄인다', () => {
    expect(DRAGON_ROUTE.left + DRAGON_ROUTE.width / 2).toBe(DRAGON_VIEW.width / 2);
    // 실제 미리보기에서 측정한 Canvas/명패 폭(sm, md, lg, 확대 lg).
    for (const [canvasWidth, badgeWidth] of [[134.9375, 66.5625], [141.703125, 71.703125], [166.15625, 84.15625], [265.85, 134.65]]) {
      const side = (canvasWidth * DRAGON_ROUTE.width / DRAGON_VIEW.width - badgeWidth) / 2;
      expect(side).toBeLessThan(1.5);
      expect(side).toBeGreaterThan(-1.5);
    }
  });
  it('몸통과 관절 뿌리/메시 좌우 경계는 모든 위상에서 고정된다', () => {
    for (let i = 0; i <= 40; i++) for (const limb of DRAGON_LIMBS) {
      for (const p of [{ x: limb.rootX, y: limb.rootY }, { x: limb.rootX, y: 220 }, { x: limb.left, y: 310 }, { x: limb.right, y: 310 }]) {
        expect(articulateDragonLimb(p, i / 40)).toEqual(p);
      }
    }
    expect(hasDragonLimb(300, 308)).toBe(false);
    expect(hasDragonLimb(432, 440)).toBe(true);
  });
  it('네 발이 움직이며 관절부터의 길이가 보존되고 최대 변위가 작다', () => {
    for (const limb of DRAGON_LIMBS) {
      const point = { x: limb.rootX, y: limb.rootY + 65 };
      let max = 0;
      for (let i = 0; i < 60; i++) {
        const p = articulateDragonLimb(point, i / 60);
        expect(Math.hypot(p.x - limb.rootX, p.y - limb.rootY)).toBeCloseTo(65, 8);
        max = Math.max(max, Math.hypot(p.x - point.x, p.y - point.y));
      }
      expect(max).toBeGreaterThan(5);
      expect(max).toBeLessThan(11);
    }
  });
  it('수염을 움직여도 눈·코·입과 수염 뿌리는 고정된다', () => {
    for (let i = 0; i < 60; i++) for (const p of [{ x: 1168, y: 212 }, { x: 1200, y: 230 }, { x: 1255, y: 250 }, { x: 1210, y: 278 }, { x: 1255, y: 285 }]) {
      expect(articulateDragonWhisker(p, i / 60)).toEqual(p);
    }
  });
  it('두 수염 끝이 서로 다른 위상으로 움직이고 과도하게 늘어나지 않는다', () => {
    for (const point of [{ x: 1112, y: 310 }, { x: 1256, y: 324 }]) {
      let max = 0;
      for (let i = 0; i < 60; i++) {
        const p = articulateDragonWhisker(point, i / 60);
        max = Math.max(max, Math.hypot(p.x - point.x, p.y - point.y));
      }
      expect(max).toBeGreaterThan(9);
      expect(max).toBeLessThan(17);
    }
  });
  it('30초 경계에서도 발/수염의 위치가 끊기지 않는다', () => {
    for (const point of [{ x: 428, y: 308 }, { x: 520, y: 298 }, { x: 900, y: 310 }, { x: 980, y: 300 }, { x: 1112, y: 310 }, { x: 1256, y: 324 }]) {
      for (const transform of [articulateDragonLimb, articulateDragonWhisker]) {
        const start = transform(point, 0);
        const end = transform(point, 1);
        expect(end.x).toBeCloseTo(start.x, 8);
        expect(end.y).toBeCloseTo(start.y, 8);
      }
    }
  });
  it('발/수염의 메시가 뒤집히거나 접히지 않는다', () => {
    for (const [warp, left, right, top, bottom, step] of [
      [articulateDragonLimb, 384, 1024, 236, 336, 8],
      [articulateDragonWhisker, 1034, 1280, 276, 348, 12],
    ] as const) {
      for (let frame = 0; frame < 30; frame++) for (let x = left; x < right; x += step) for (let y = top; y < bottom; y += step) {
        const a = warp({ x, y }, frame / 30);
        const b = warp({ x: x + step, y }, frame / 30);
        const c = warp({ x, y: y + step }, frame / 30);
        expect((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)).toBeGreaterThan(0);
      }
    }
  });
});
