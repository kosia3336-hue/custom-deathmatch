/** 명패의 직선/반원 테두리. 거리로 샘플링하므로 곡선에서도 이동 속도가 일정하다. */
export const DRAGON_VIEW = { width: 820, height: 430 };
// 좌우 캡을 명패 테두리 가까이 붙인다. 종전 500px 경로는 실제 명패보다 약 20% 넓었다.
export const DRAGON_ROUTE = { left: 200, top: 150, width: 420, height: 130 };
const radius = DRAGON_ROUTE.height / 2;
const straight = DRAGON_ROUTE.width - DRAGON_ROUTE.height;
const halfArc = Math.PI * radius;
export const DRAGON_ROUTE_LENGTH = straight * 2 + halfArc * 2;
export const DRAGON_CYCLE_MS = 30_000;
export const DRAGON_MOTION = { bodyFraction: 0.66, headFactor: 0.86, headLift: -6 };

export type DragonMeshPoint = { x: number; y: number };

/** 가느다란 삼각형도 각 변의 바깥 법선으로 겹친다. 방사형 확대는 긴 변의 틈을 막지 못한다. */
export function expandDragonTriangle(points: [DragonMeshPoint, DragonMeshPoint, DragonMeshPoint], padding = 0.8) {
  const [a, b, c] = points;
  const winding = Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) || 1;
  const normals = points.map((p, i) => {
    const q = points[(i + 1) % 3];
    const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: (q.y - p.y) / length * winding * padding, y: -(q.x - p.x) / length * winding * padding };
  });
  // 베벨 모서리: 예각을 크게 늘려 원화의 다른 부위까지 새어 나오지 않게 한다.
  return points.flatMap((p, i) => [normals[(i + 2) % 3], normals[i]].map(n => ({ x: p.x + n.x, y: p.y + n.y })));
}

export type DragonPoint = { x: number; y: number; tx: number; ty: number; nx: number; ny: number };

export function pointOnDragonRoute(distance: number): DragonPoint {
  let d = ((distance % DRAGON_ROUTE_LENGTH) + DRAGON_ROUTE_LENGTH) % DRAGON_ROUTE_LENGTH;
  let x: number;
  let y: number;
  let tx: number;
  let ty: number;
  const leftCentre = DRAGON_ROUTE.left + radius;
  const rightCentre = DRAGON_ROUTE.left + DRAGON_ROUTE.width - radius;
  if (d < straight) {
    x = leftCentre + d; y = DRAGON_ROUTE.top; tx = 1; ty = 0;
  } else if ((d -= straight) < halfArc) {
    const angle = -Math.PI / 2 + d / radius;
    x = rightCentre + Math.cos(angle) * radius;
    y = DRAGON_ROUTE.top + radius + Math.sin(angle) * radius;
    tx = -Math.sin(angle); ty = Math.cos(angle);
  } else if ((d -= halfArc) < straight) {
    x = rightCentre - d; y = DRAGON_ROUTE.top + DRAGON_ROUTE.height; tx = -1; ty = 0;
  } else {
    d -= straight;
    const angle = Math.PI / 2 + d / radius;
    x = leftCentre + Math.cos(angle) * radius;
    y = DRAGON_ROUTE.top + radius + Math.sin(angle) * radius;
    tx = -Math.sin(angle); ty = Math.cos(angle);
  }
  return { x, y, tx, ty, nx: -ty, ny: tx };
}

export function dragonHeadDistance(progress: number) {
  return straight - 100 + progress * DRAGON_ROUTE_LENGTH;
}

export function dragonNeckBlend(x: number, headX: number) {
  const t = Math.max(0, Math.min(1, (x - (headX - 160)) / 160));
  return t * t * (3 - 2 * t);
}

/** 머리와 겹쳐 그리는 마지막 24px는 머리와 정확히 같은 강체 좌표를 사용한다. */
export function dragonNeckRigidBlend(x: number, headX: number) {
  const t = Math.max(0, Math.min(1, (x - (headX - 64)) / 40));
  return t * t * (3 - 2 * t);
}

/** 회전 + 균일 확대축소만 있는 머리 행렬. 눈/얼굴을 비균등하게 변형하지 않는다. */
export function dragonHeadTransform(progress: number, sourceHeadX: number) {
  const p = pointOnDragonRoute(dragonHeadDistance(progress));
  const scale = DRAGON_ROUTE_LENGTH * DRAGON_MOTION.bodyFraction / sourceHeadX * DRAGON_MOTION.headFactor;
  return {
    a: p.tx * scale, b: p.ty * scale, c: p.nx * scale, d: p.ny * scale,
    e: p.x + p.nx * DRAGON_MOTION.headLift, f: p.y + p.ny * DRAGON_MOTION.headLift,
  };
}
