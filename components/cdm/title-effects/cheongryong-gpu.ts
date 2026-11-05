import { DRAGON_FRAGMENT_SHADER, getDragonMesh, DRAGON_VERTEX_SHADER } from './cheongryong-mesh';
import { dragonHeadTransform } from './cheongryong-path';
import rig from './cheongryong-rig.json';

/** 문서당 한 컨텍스트. 원화/정적 메시를 한 번 올리고 프레임마다 uniform + drawArrays 한 번만 전송한다. */
export function createDragonGpu(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
  if (!gl) return null;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  let texture: WebGLTexture | null = null;
  let progress: WebGLUniformLocation | null = null;
  let basis: WebGLUniformLocation | null = null;
  let offset: WebGLUniformLocation | null = null;
  let lost = false;
  let failed = false;
  let needsInit = true;
  const release = () => {
    gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program);
    texture = null; buffer = null; program = null;
  };
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  };
  const init = () => {
    release();
    const vertex = compile(gl.VERTEX_SHADER, DRAGON_VERTEX_SHADER);
    const fragment = compile(gl.FRAGMENT_SHADER, DRAGON_FRAGMENT_SHADER);
    if (!vertex || !fragment) { gl.deleteShader(vertex); gl.deleteShader(fragment); return false; }
    program = gl.createProgram();
    if (!program) { gl.deleteShader(vertex); gl.deleteShader(fragment); return false; }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { release(); return false; }
    buffer = gl.createBuffer(); texture = gl.createTexture();
    if (!buffer || !texture) { release(); return false; }
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, getDragonMesh().data, gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, 'a_source');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0);
    progress = gl.getUniformLocation(program, 'u_progress');
    basis = gl.getUniformLocation(program, 'u_headBasis');
    offset = gl.getUniformLocation(program, 'u_headOffset');
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.DITHER);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    // 업로드 오류는 최초 1회만 확인한다. 매 프레임 동기식 GPU 상태 질의를 하지 않는다.
    if (gl.getError() !== gl.NO_ERROR) { release(); return false; }
    needsInit = false;
    return true;
  };
  const onLost = (event: Event) => { event.preventDefault(); lost = true; };
  const onRestored = () => { lost = false; failed = false; needsInit = true; };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);
  return {
    canvas,
    draw(phase: number, width: number, height: number) {
      if (lost || failed) return false;
      if (needsInit && !init()) { failed = true; return false; }
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const head = dragonHeadTransform(phase, rig.headX);
      gl.uniform1f(progress, phase);
      gl.uniform4f(basis, head.a, head.b, head.c, head.d);
      gl.uniform2f(offset, head.e, head.f);
      gl.drawArrays(gl.TRIANGLES, 0, getDragonMesh().vertexCount);
      return true;
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      release();
      // 컨텍스트 수를 페이지 이동 후에도 계속 점유하지 않는다.
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.width = canvas.height = 1;
    },
  };
}
