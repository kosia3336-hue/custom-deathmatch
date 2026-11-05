import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDragonGpu } from '../../../components/cdm/title-effects/cheongryong-gpu';

let surface: EventTarget & { width: number; height: number; getContext: ReturnType<typeof vi.fn> };
let gl: Record<string, any>;
beforeEach(() => {
  gl = { VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5, STATIC_DRAW: 6, FLOAT: 7, TEXTURE0: 8, TEXTURE_2D: 9, NO_ERROR: 0, TRIANGLES: 10 };
  for (const name of ['deleteTexture', 'deleteBuffer', 'deleteProgram', 'shaderSource', 'compileShader', 'deleteShader', 'attachShader', 'linkProgram', 'useProgram', 'bindBuffer', 'bufferData', 'enableVertexAttribArray', 'vertexAttribPointer', 'activeTexture', 'bindTexture', 'pixelStorei', 'texParameteri', 'texImage2D', 'uniform1i', 'disable', 'enable', 'blendFunc', 'clearColor', 'viewport', 'clear', 'uniform1f', 'uniform4f', 'uniform2f', 'drawArrays']) gl[name] = vi.fn();
  for (const name of ['createShader', 'createProgram', 'createBuffer', 'createTexture', 'getUniformLocation']) gl[name] = vi.fn(() => ({}));
  gl.getShaderParameter = vi.fn(() => true);
  gl.getProgramParameter = vi.fn(() => true);
  gl.getAttribLocation = vi.fn(() => 0);
  gl.getError = vi.fn(() => 0);
  gl.getExtension = vi.fn(() => ({ loseContext: vi.fn() }));
  surface = Object.assign(new EventTarget(), { width: 300, height: 150, getContext: vi.fn(() => gl) });
  vi.stubGlobal('document', { createElement: () => surface });
});
afterEach(() => vi.unstubAllGlobals());

describe('청룡 GPU 자원/복구', () => {
  it('정적 메시/원화 업로드는 한 번, 매 프레임 drawArrays는 한 번뿐이다', () => {
    const renderer = createDragonGpu({} as HTMLImageElement)!;
    for (let i = 0; i < 10; i++) expect(renderer.draw(i / 10, 410, 215)).toBe(true);
    expect(gl.bufferData).toHaveBeenCalledTimes(1);
    expect(gl.texImage2D).toHaveBeenCalledTimes(1);
    expect(gl.drawArrays).toHaveBeenCalledTimes(10);
    expect(gl.getError).toHaveBeenCalledTimes(1);
    renderer.dispose();
    expect(surface.width).toBe(1);
    expect(gl.deleteTexture).toHaveBeenCalledWith(expect.any(Object));
  });
  it('컨텍스트 손실 중 false로 폴백하고 복구 후 텍스처/버퍼를 재업로드한다', () => {
    const renderer = createDragonGpu({} as HTMLImageElement)!;
    renderer.draw(0, 410, 215);
    const event = new Event('webglcontextlost', { cancelable: true });
    surface.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(renderer.draw(0.1, 410, 215)).toBe(false);
    surface.dispatchEvent(new Event('webglcontextrestored'));
    expect(renderer.draw(0.2, 410, 215)).toBe(true);
    expect(gl.texImage2D).toHaveBeenCalledTimes(2);
    renderer.dispose();
  });
  it('셰이더 실패는 반복 컴파일하지 않으며 2D 폴백에 제어를 넘긴다', () => {
    gl.getShaderParameter.mockReturnValue(false);
    const renderer = createDragonGpu({} as HTMLImageElement)!;
    expect(renderer.draw(0, 410, 215)).toBe(false);
    expect(renderer.draw(0.1, 410, 215)).toBe(false);
    expect(gl.compileShader).toHaveBeenCalledTimes(2);
    expect(gl.drawArrays).not.toHaveBeenCalled();
    renderer.dispose();
  });
  it('WebGL이 없는 환경에서는 컨텍스트를 추가로 요구하지 않는다', () => {
    surface.getContext.mockReturnValue(null);
    expect(createDragonGpu({} as HTMLImageElement)).toBeNull();
    expect(surface.getContext).toHaveBeenCalledTimes(1);
  });
});
