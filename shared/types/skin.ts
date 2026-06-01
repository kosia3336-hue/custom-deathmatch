/**
 * 게임 스킨 공유 타입 (프론트·서버 공용).
 *
 * skinId 는 DB의 skins.id (예: 'skin-g001-01') 와 동일하며,
 * 프론트 스킨 레지스트리(lib/skins/registry)가 실제 비주얼로 매핑한다.
 */

/** 스킨 식별자. DB skins.id 와 동일 (느슨 결합 — 레지스트리가 검증) */
export type SkinId = string;

/** 회원이 착용 중인 스킨 1건 (게임 ID 포함 스냅샷) */
export interface EquippedSkin {
  skinId: SkinId;
  gameId: string;
}
