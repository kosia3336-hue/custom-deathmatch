import { describe, expect, it } from 'vitest';
import { createDragonClock, dragonFrameIndex, dragonPixelRatio, dragonSurfaceSize } from '../../../components/cdm/title-effects/cheongryong-performance';
import { getDragonMesh, DRAGON_VERTEX_SHADER } from '../../../components/cdm/title-effects/cheongryong-mesh';

describe('청룡 렌더링 정책', () => {
  it('작은 칭호는 1/4 픽셀 표면을 쓰고 확대 표면도 원래 해상도 이하이다', () => {
    expect(dragonSurfaceSize(270)).toEqual({ width: 410, height: 215 });
    expect(dragonSurfaceSize(410)).toEqual({ width: 410, height: 215 });
    expect(dragonSurfaceSize(411)).toEqual({ width: 820, height: 430 });
    expect(dragonSurfaceSize(2400)).toEqual({ width: 820, height: 430 });
    expect(dragonPixelRatio(1)).toBe(1);
    expect(dragonPixelRatio(3)).toBe(2);
    expect(dragonPixelRatio(NaN)).toBe(1);
  });
  it('30초 시계는 900프레임으로 닫히고 정지/재생 중 시간이 뛰지 않는다', () => {
    expect(dragonFrameIndex(0)).toBe(0);
    expect(dragonFrameIndex(29_999)).toBe(899);
    expect(dragonFrameIndex(30_000)).toBe(0);
    const clock = createDragonClock();
    expect(clock.elapsed(1000)).toBe(0);
    expect(clock.elapsed(2000)).toBe(1000);
    clock.pause(2100);
    expect(clock.elapsed(9000)).toBe(1100);
    clock.pause(10_000);
    clock.resume(12_100);
    expect(clock.elapsed(12_300)).toBe(1300);
    expect(clock.paused).toBe(false);
  });
  it('원화와 리그에서 유효한 정적 GPU 메시를 한 번 만든다', () => {
    const { data: DRAGON_MESH, triangleCount: DRAGON_TRIANGLE_COUNT } = getDragonMesh();
    expect(getDragonMesh()).toBe(getDragonMesh());
    expect(DRAGON_MESH.length % 12).toBe(0);
    expect(DRAGON_TRIANGLE_COUNT).toBeGreaterThan(500);
    expect(DRAGON_TRIANGLE_COUNT).toBeLessThan(1200);
    for (const n of DRAGON_MESH) expect(Number.isFinite(n)).toBe(true);
    for (let i = 0; i < DRAGON_MESH.length; i += 4) {
      expect(DRAGON_MESH[i]).toBeGreaterThanOrEqual(0);
      expect(DRAGON_MESH[i]).toBeLessThanOrEqual(1280);
      expect(DRAGON_MESH[i + 1]).toBeGreaterThanOrEqual(0);
      expect(DRAGON_MESH[i + 1]).toBeLessThanOrEqual(427);
      expect([0, 1]).toContain(DRAGON_MESH[i + 3]);
    }
    expect(DRAGON_VERTEX_SHADER).toContain('smoothstep(278.0,310.0,p.y)');
    expect(DRAGON_VERTEX_SHADER).toContain('smoothstep(390.000000000, 414.000000000, p.x)');
  });
});
