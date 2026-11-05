import rig from './cheongryong-rig.json';
import { DRAGON_MOTION, DRAGON_ROUTE_LENGTH, DRAGON_VIEW, dragonHeadDistance, dragonHeadTransform, dragonNeckBlend, dragonNeckRigidBlend, expandDragonTriangle, pointOnDragonRoute } from './cheongryong-path';
import { articulateDragonLimb, articulateDragonWhisker, hasDragonLimb } from './cheongryong-articulation';

const BODY_SCALE = DRAGON_ROUTE_LENGTH * DRAGON_MOTION.bodyFraction / rig.headX;
const HEAD_FACTOR = DRAGON_MOTION.headFactor;
const HEAD_LIFT = DRAGON_MOTION.headLift;

type Point = { x: number; y: number };

function drawTriangle(ctx: CanvasRenderingContext2D, image: HTMLImageElement, source: [Point, Point, Point], target: [Point, Point, Point]) {
  const [s0, s1, s2] = source;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 0.001) return;
  const coefficients = (values: number[]) => [
    (values[0] * (s1.y - s2.y) + values[1] * (s2.y - s0.y) + values[2] * (s0.y - s1.y)) / denominator,
    (values[0] * (s2.x - s1.x) + values[1] * (s0.x - s2.x) + values[2] * (s1.x - s0.x)) / denominator,
    (values[0] * (s1.x * s2.y - s2.x * s1.y) + values[1] * (s2.x * s0.y - s0.x * s2.y) + values[2] * (s0.x * s1.y - s1.x * s0.y)) / denominator,
  ];
  const [a, c, e] = coefficients(target.map(p => p.x));
  const [b, d, f] = coefficients(target.map(p => p.y));
  ctx.save();
  ctx.beginPath();
  expandDragonTriangle(target).forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

function drawQuad(ctx: CanvasRenderingContext2D, image: HTMLImageElement, source: [Point, Point, Point, Point], target: Point[]) {
  drawTriangle(ctx, image, [source[0], source[1], source[2]], [target[0], target[1], target[2]]);
  drawTriangle(ctx, image, [source[0], source[2], source[3]], [target[0], target[2], target[3]]);
}

export function drawDragonCanvas(ctx: CanvasRenderingContext2D, image: HTMLImageElement, progress: number) {
  ctx.clearRect(0, 0, DRAGON_VIEW.width, DRAGON_VIEW.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const headDistance = dragonHeadDistance(progress);
  const head = dragonHeadTransform(progress, rig.headX);
  const mapPoint = (x: number, y: number, centreY: number): Point => {
    const blend = dragonNeckBlend(x, rig.headX);
    const p = pointOnDragonRoute(headDistance - (rig.headX - x) * BODY_SCALE);
    const scale = BODY_SCALE * (1 - (1 - HEAD_FACTOR) * blend);
    const anchorY = centreY * (1 - blend) + rig.headY * blend;
    const normal = (y - anchorY) * scale + HEAD_LIFT * blend;
    const body = { x: p.x + p.nx * normal, y: p.y + p.ny * normal };
    const rigidBlend = dragonNeckRigidBlend(x, rig.headX);
    const rigid = { x: head.a * (x - rig.headX) + head.c * (y - rig.headY) + head.e, y: head.b * (x - rig.headX) + head.d * (y - rig.headY) + head.f };
    return { x: body.x + (rigid.x - body.x) * rigidBlend, y: body.y + (rigid.y - body.y) * rigidBlend };
  };
  // 호환 경로는 표시 크기가 작은 칭호용 저밀도 메시. 얼굴은 원화 그대로 유지한다.
  for (let i = 0; i < rig.profiles.length - 1; i += 2) {
    const p0 = rig.profiles[i];
    const p1 = rig.profiles[Math.min(i + 2, rig.profiles.length - 1)];
    if (p0.x >= rig.headX) break;
    const x0 = p0.x;
    const x1 = Math.min(p1.x, rig.headX);
    const top = Math.min(p0.top, p1.top);
    const bottom = Math.max(p0.bottom, p1.bottom);
    if (bottom <= top) continue;
    // 관절이 있는 열의 아랫부분만 세분화한다. 몸통 전체를 흔들거나 발을 복제하지 않는다.
    const rows = [top];
    if (hasDragonLimb(x0, x1)) for (let y = 236; y < bottom; y += 24) if (y > top) rows.push(y);
    rows.push(bottom);
    for (let row = 0; row < rows.length - 1; row++) {
      const s: [Point, Point, Point, Point] = [{ x: x0, y: rows[row] }, { x: x1, y: rows[row] }, { x: x1, y: rows[row + 1] }, { x: x0, y: rows[row + 1] }];
      const t = s.map((p, j) => {
        const animated = articulateDragonLimb(p, progress);
        return mapPoint(animated.x, animated.y, j === 0 || j === 3 ? p0.y : p1.y);
      });
      drawQuad(ctx, image, s, t);
    }
  }
  // 얼굴은 강체로 유지한다. 아래쪽 수염만 별도 메시로 이어 그린다.
  const overlap = 16;
  ctx.save();
  ctx.transform(head.a, head.b, head.c, head.d, head.e, head.f);
  ctx.drawImage(image, rig.headX - overlap, 0, rig.width - rig.headX + overlap, 278, -overlap, -rig.headY, rig.width - rig.headX + overlap, 278);
  ctx.restore();
  const headPoint = (point: Point) => {
    const p = articulateDragonWhisker(point, progress);
    return { x: head.a * (p.x - rig.headX) + head.c * (p.y - rig.headY) + head.e, y: head.b * (p.x - rig.headX) + head.d * (p.y - rig.headY) + head.f };
  };
  // 2px는 고정 얼굴과 겹치는 칼라. 수염 뿌리와 얼굴 사이의 래스터 경계가 갈라지지 않는다.
  for (let x0 = rig.headX - overlap; x0 < rig.width; x0 += 24) for (let y0 = 276; y0 < 348; y0 += 24) {
    const x1 = Math.min(x0 + 24, rig.width);
    const y1 = Math.min(y0 + 24, 348);
    const s: [Point, Point, Point, Point] = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    drawQuad(ctx, image, s, s.map(headPoint));
  }
}


