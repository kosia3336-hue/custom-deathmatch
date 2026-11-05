import type { DragonMeshPoint } from './cheongryong-path';

// dragon-travel.webp(1280×427) 원화의 관절 좌표. 몸통/얼굴은 움직이지 않고 부속만 변형한다.
export const DRAGON_LIMBS = [
  { left: 390, right: 468, rootX: 448, rootY: 236, amplitude: 0.15, cycles: 6, phase: 0 },
  { left: 468, right: 550, rootX: 486, rootY: 246, amplitude: 0.12, cycles: 6, phase: Math.PI * 0.8 },
  { left: 850, right: 934, rootX: 910, rootY: 236, amplitude: 0.15, cycles: 6, phase: Math.PI },
  { left: 934, right: 1018, rootX: 960, rootY: 246, amplitude: 0.12, cycles: 6, phase: Math.PI * 1.8 },
] as const;

function smooth(from: number, to: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export function hasDragonLimb(left: number, right: number) {
  return DRAGON_LIMBS.some(limb => right > limb.left && left < limb.right);
}

/** 관절은 고정하고 발끝으로 갈수록 회전을 늘린다. 좌우 경계도 0으로 이어 메시 틈을 막는다. */
export function articulateDragonLimb(point: DragonMeshPoint, progress: number): DragonMeshPoint {
  for (const limb of DRAGON_LIMBS) {
    if (point.x <= limb.left || point.x >= limb.right || point.y <= limb.rootY) continue;
    const weight = smooth(limb.rootY, limb.rootY + 44, point.y)
      * smooth(limb.left, limb.left + 24, point.x)
      * (1 - smooth(limb.right - 24, limb.right, point.x));
    const angle = Math.sin(progress * Math.PI * 2 * limb.cycles + limb.phase) * limb.amplitude * weight;
    const dx = point.x - limb.rootX;
    const dy = point.y - limb.rootY;
    return { x: limb.rootX + dx * Math.cos(angle) - dy * Math.sin(angle), y: limb.rootY + dx * Math.sin(angle) + dy * Math.cos(angle) };
  }
  return point;
}

/** 턱 아래 두 수염의 끝만 흘린다. 눈/코/입/수염 뿌리에는 변형을 적용하지 않는다. */
export function articulateDragonWhisker(point: DragonMeshPoint, progress: number): DragonMeshPoint {
  const left = smooth(278, 310, point.y) * (1 - smooth(1170, 1234, point.x));
  const right = smooth(285, 323, point.y) * smooth(1200, 1250, point.x);
  const leftWave = progress * Math.PI * 2 * 8 + (point.x - 1100) * 0.018;
  const rightWave = progress * Math.PI * 2 * 6 + (point.x - 1210) * 0.025 + 1.2;
  return {
    x: point.x + Math.sin(leftWave + 0.7) * 7 * left + Math.sin(rightWave + 0.5) * 6 * right,
    y: point.y + Math.sin(leftWave) * 13 * left + Math.sin(rightWave) * 12 * right,
  };
}
