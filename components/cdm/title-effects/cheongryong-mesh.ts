import rig from './cheongryong-rig.json';
import { DRAGON_LIMBS, hasDragonLimb } from './cheongryong-articulation';
import { DRAGON_MOTION, DRAGON_ROUTE, DRAGON_ROUTE_LENGTH, DRAGON_VIEW } from './cheongryong-path';

// 원화의 UV/몸통 중심선/부위만 한 번 업로드한다. 위치·관절 계산은 vertex shader에서 수행.
function buildDragonMesh() {
  const vertices: number[] = [];
  function quad(x0: number, x1: number, y0: number, y1: number, centre0: number, centre1: number, kind: number) {
    const points = [[x0, y0, centre0, kind], [x1, y0, centre1, kind], [x1, y1, centre1, kind], [x0, y1, centre0, kind]];
    for (const i of [0, 1, 2, 0, 2, 3]) vertices.push(...points[i]);
  }
  for (let i = 0; i < rig.profiles.length - 1; i++) {
    const a = rig.profiles[i];
    const b = rig.profiles[i + 1];
    if (a.x >= rig.headX) break;
    const top = Math.min(a.top, b.top);
    const bottom = Math.max(a.bottom, b.bottom);
    if (bottom <= top) continue;
    const rows = [top];
    if (hasDragonLimb(a.x, b.x)) for (let y = 236; y < bottom; y += 16) if (y > top) rows.push(y);
    rows.push(bottom);
    for (let row = 0; row < rows.length - 1; row++) quad(a.x, Math.min(b.x, rig.headX), rows[row], rows[row + 1], a.y, b.y, 0);
  }
  quad(rig.headX - 16, rig.width, 0, 278, 0, 0, 1);
  for (let x = rig.headX - 16; x < rig.width; x += 12) for (let y = 276; y < 348; y += 12) quad(x, Math.min(x + 12, rig.width), y, Math.min(y + 12, 348), 0, 0, 1);
  
  const data = new Float32Array(vertices);
  return { data, vertexCount: data.length / 4, triangleCount: data.length / 12 };
}
let sharedMesh: ReturnType<typeof buildDragonMesh> | undefined;
export function getDragonMesh() { return sharedMesh ??= buildDragonMesh(); }

const gl = (n: number) => n.toFixed(9);
const scale = DRAGON_ROUTE_LENGTH * DRAGON_MOTION.bodyFraction / rig.headX;
const radius = DRAGON_ROUTE.height / 2;
const straight = DRAGON_ROUTE.width - DRAGON_ROUTE.height;
const arc = Math.PI * radius;
const limbCode = DRAGON_LIMBS.map((limb, i) => `${i ? 'else ' : ''}if (p.x > ${gl(limb.left)} && p.x < ${gl(limb.right)} && p.y > ${gl(limb.rootY)}) {
  float weight = smoothstep(${gl(limb.rootY)}, ${gl(limb.rootY + 44)}, p.y) * smoothstep(${gl(limb.left)}, ${gl(limb.left + 24)}, p.x) * (1.0 - smoothstep(${gl(limb.right - 24)}, ${gl(limb.right)}, p.x));
  float angle = sin(u_progress * 6.283185307 * ${gl(limb.cycles)} + ${gl(limb.phase)}) * ${gl(limb.amplitude)} * weight;
  vec2 d = p - vec2(${gl(limb.rootX)}, ${gl(limb.rootY)});
  p = vec2(${gl(limb.rootX)}, ${gl(limb.rootY)}) + vec2(d.x*cos(angle)-d.y*sin(angle), d.x*sin(angle)+d.y*cos(angle));
}`).join('\n');

export const DRAGON_VERTEX_SHADER = `
precision highp float;
attribute vec4 a_source;
uniform float u_progress;
uniform vec4 u_headBasis;
uniform vec2 u_headOffset;
varying vec2 v_uv;
vec2 headPoint(vec2 p) {
  p -= vec2(${gl(rig.headX)}, ${gl(rig.headY)});
  return vec2(u_headBasis.x*p.x + u_headBasis.z*p.y, u_headBasis.y*p.x + u_headBasis.w*p.y) + u_headOffset;
}
vec4 route(float distance) {
  float d = mod(distance, ${gl(DRAGON_ROUTE_LENGTH)});
  float angle;
  if (d < ${gl(straight)}) return vec4(${gl(DRAGON_ROUTE.left + radius)} + d, ${gl(DRAGON_ROUTE.top)}, 1.0, 0.0);
  d -= ${gl(straight)};
  if (d < ${gl(arc)}) {
    angle = -1.570796327 + d / ${gl(radius)};
    return vec4(vec2(${gl(DRAGON_ROUTE.left + DRAGON_ROUTE.width - radius)}, ${gl(DRAGON_ROUTE.top + radius)}) + vec2(cos(angle),sin(angle))*${gl(radius)}, -sin(angle),cos(angle));
  }
  d -= ${gl(arc)};
  if (d < ${gl(straight)}) return vec4(${gl(DRAGON_ROUTE.left + DRAGON_ROUTE.width - radius)} - d, ${gl(DRAGON_ROUTE.top + DRAGON_ROUTE.height)}, -1.0, 0.0);
  d -= ${gl(straight)};
  angle = 1.570796327 + d / ${gl(radius)};
  return vec4(vec2(${gl(DRAGON_ROUTE.left + radius)}, ${gl(DRAGON_ROUTE.top + radius)}) + vec2(cos(angle),sin(angle))*${gl(radius)}, -sin(angle),cos(angle));
}
void main() {
  vec2 p = a_source.xy;
  v_uv = p / vec2(${gl(rig.width)}, ${gl(rig.height)});
  vec2 target;
  if (a_source.w < 0.5) {
    ${limbCode}
    float neck = smoothstep(${gl(rig.headX - 160)}, ${gl(rig.headX)}, p.x);
    vec4 r = route(${gl(straight - 100)} + u_progress*${gl(DRAGON_ROUTE_LENGTH)} - (${gl(rig.headX)}-p.x)*${gl(scale)});
    float widthScale = ${gl(scale)} * (1.0 - ${gl(1 - DRAGON_MOTION.headFactor)}*neck);
    float normal = (p.y-mix(a_source.z,${gl(rig.headY)},neck))*widthScale + ${gl(DRAGON_MOTION.headLift)}*neck;
    target = r.xy + vec2(-r.w,r.z)*normal;
    target = mix(target, headPoint(p), smoothstep(${gl(rig.headX - 64)},${gl(rig.headX - 24)},p.x));
  } else {
    float left = smoothstep(278.0,310.0,p.y) * (1.0-smoothstep(1170.0,1234.0,p.x));
    float right = smoothstep(285.0,323.0,p.y) * smoothstep(1200.0,1250.0,p.x);
    float l = u_progress*6.283185307*8.0 + (p.x-1100.0)*0.018;
    float r = u_progress*6.283185307*6.0 + (p.x-1210.0)*0.025 + 1.2;
    p += vec2(sin(l+0.7)*7.0*left+sin(r+0.5)*6.0*right, sin(l)*13.0*left+sin(r)*12.0*right);
    target = headPoint(p);
  }
  gl_Position = vec4(target.x/${gl(DRAGON_VIEW.width)}*2.0-1.0, 1.0-target.y/${gl(DRAGON_VIEW.height)}*2.0, 0.0, 1.0);
}`;
export const DRAGON_FRAGMENT_SHADER = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_texture;
void main() { gl_FragColor = texture2D(u_texture, v_uv); }
`;
