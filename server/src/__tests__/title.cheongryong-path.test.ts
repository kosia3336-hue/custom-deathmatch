import { describe, expect, it } from 'vitest';
import { DRAGON_MOTION, DRAGON_ROUTE, DRAGON_ROUTE_LENGTH, dragonHeadDistance, dragonHeadTransform, dragonNeckBlend, dragonNeckRigidBlend, expandDragonTriangle, pointOnDragonRoute } from '../../../components/cdm/title-effects/cheongryong-path';

describe('청룡 명패 경로', () => {
  it('30초 루프의 시작과 끝이 같은 위치/방향이다', () => {
    const start = pointOnDragonRoute(dragonHeadDistance(0));
    const end = pointOnDragonRoute(dragonHeadDistance(1));
    for (const key of ['x', 'y', 'tx', 'ty'] as const) expect(end[key]).toBeCloseTo(start[key], 8);
  });
  it('직선/반원 연결부와 음수 거리에서 연속적으로 이어진다', () => {
    const straight = DRAGON_ROUTE.width - DRAGON_ROUTE.height;
    const arc = Math.PI * DRAGON_ROUTE.height / 2;
    for (const distance of [0, straight, straight + arc, straight * 2 + arc, DRAGON_ROUTE_LENGTH, -DRAGON_ROUTE_LENGTH]) {
      const before = pointOnDragonRoute(distance - 0.001);
      const after = pointOnDragonRoute(distance + 0.001);
      expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.0021);
      expect(Math.hypot(before.tx - after.tx, before.ty - after.ty)).toBeLessThan(0.0001);
    }
  });
  it('모든 구간에서 같은 거리만큼 움직이고 접선/법선은 서로 직교한다', () => {
    for (let i = 0; i < 100; i++) {
      const d = i / 100 * DRAGON_ROUTE_LENGTH;
      const p = pointOnDragonRoute(d);
      const q = pointOnDragonRoute(d + 1);
      expect(Math.hypot(q.x - p.x, q.y - p.y)).toBeCloseTo(1, 3);
      expect((q.x - p.x) * p.tx + (q.y - p.y) * p.ty).toBeGreaterThan(0.999);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 10);
      expect(p.tx * p.nx + p.ty * p.ny).toBeCloseTo(0, 10);
    }
  });
  it('머리/꼬리 연결부의 보정은 부드럽고 범위를 넘지 않는다', () => {
    expect(dragonNeckBlend(800, 1050)).toBe(0);
    expect(dragonNeckBlend(1050, 1050)).toBe(1);
    expect(dragonNeckBlend(1100, 1050)).toBe(1);
    expect(dragonNeckBlend(970, 1050)).toBeCloseTo(0.5);
  });
  it('한 바퀴 내내 머리의 가로·세로 배율이 같고 기울임/찌그러짐이 없다', () => {
    for (let i = 0; i <= 120; i++) {
      const m = dragonHeadTransform(i / 120, 1050);
      expect(Math.hypot(m.a, m.b)).toBeCloseTo(Math.hypot(m.c, m.d), 10);
      expect(m.a * m.c + m.b * m.d).toBeCloseTo(0, 10);
      expect(m.a * m.d - m.b * m.c).toBeGreaterThan(0);
    }
  });
  it('머리가 테두리에서 들리지 않고 목의 중첩 구간은 같은 강체로 연결된다', () => {
    expect(Math.abs(DRAGON_MOTION.headLift)).toBeLessThanOrEqual(6);
    expect(dragonNeckRigidBlend(1050 - 64, 1050)).toBe(0);
    expect(dragonNeckRigidBlend(1050 - 44, 1050)).toBeCloseTo(0.5);
    for (let x = 1050 - 24; x <= 1050; x++) expect(dragonNeckRigidBlend(x, 1050)).toBe(1);
  });
  it('긴 메시의 양쪽 변도 법선 방향으로 겹치며 예각의 과도한 확장은 없다', () => {
    const triangle: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] = [{ x: 0, y: 0 }, { x: 4, y: 200 }, { x: 0, y: 200 }];
    for (const points of [triangle, [...triangle].reverse() as typeof triangle]) {
      const expanded = expandDragonTriangle(points);
      const winding = Math.sign((points[1].x - points[0].x) * (points[2].y - points[0].y) - (points[1].y - points[0].y) * (points[2].x - points[0].x));
      for (let i = 0; i < 3; i++) {
        const p = points[i];
        const q = points[(i + 1) % 3];
        const length = Math.hypot(q.x - p.x, q.y - p.y);
        const n = { x: (q.y - p.y) / length * winding, y: -(q.x - p.x) / length * winding };
        for (const v of [expanded[i * 2 + 1], expanded[((i + 1) % 3) * 2]]) {
          expect((v.x - p.x) * n.x + (v.y - p.y) * n.y).toBeCloseTo(0.8, 8);
        }
        for (const v of expanded.slice(i * 2, i * 2 + 2)) expect(Math.hypot(v.x - p.x, v.y - p.y)).toBeCloseTo(0.8, 8);
      }
    }
  });
  it('진행 방향이 시계 방향이고 머리가 그 방향을 향한다', () => {
    let area = 0;
    for (let i = 0; i < 120; i++) {
      const p = pointOnDragonRoute(dragonHeadDistance(i / 120));
      const q = pointOnDragonRoute(dragonHeadDistance((i + 1) / 120));
      area += p.x * q.y - q.x * p.y;
      const m = dragonHeadTransform(i / 120, 1050);
      expect(m.a * (q.x - p.x) + m.b * (q.y - p.y)).toBeGreaterThan(0);
    }
    // Canvas의 아래쪽이 +Y이므로 양의 면적이 시계 방향이다.
    expect(area).toBeGreaterThan(0);
  });
});
