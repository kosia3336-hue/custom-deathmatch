import { describe, expect, it, vi } from 'vitest';
import { drawDragonCanvas } from '../../../components/cdm/title-effects/cheongryong-canvas';

describe('청룡 저비용 2D 호환 메시', () => {
  it('동작/얼굴을 보존하면서 기존981회보다 훨씬 적은 drawImage로 그린다', () => {
    const context = { clearRect: vi.fn(), save: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), clip: vi.fn(), transform: vi.fn(), drawImage: vi.fn(), restore: vi.fn() };
    for (const phase of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      context.drawImage.mockClear(); context.transform.mockClear();
      drawDragonCanvas(context as unknown as CanvasRenderingContext2D, {} as HTMLImageElement, phase);
      expect(context.drawImage.mock.calls.length).toBeLessThan(400);
      expect(context.drawImage.mock.calls.length).toBeGreaterThan(200);
      for (const args of context.transform.mock.calls) for (const n of args) expect(Number.isFinite(n)).toBe(true);
    }
  });
});
