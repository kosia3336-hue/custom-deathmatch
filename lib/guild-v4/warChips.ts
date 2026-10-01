/** 길드전 상점 팩. SQL `purchase_guild_war_chip_pack` 과 같게 유지. */
export const GUILD_WAR_CHIP_PACK_SIZE = 10;
export const GUILD_WAR_CHIP_PACK_GP = 100;
/** `/shop` 소모품 수량 상한과 같음. */
export const GUILD_WAR_CHIP_PACK_QTY_MAX = 99;
/** 기간 종료 환전. 1칩당 GP (수수료 20%). */
export const GUILD_WAR_CHIP_REFUND_GP = 8;

export function clampGuildWarChipPackQty(n: number): number {
  const q = Math.trunc(n);
  if (!Number.isFinite(q)) return 1;
  return Math.min(GUILD_WAR_CHIP_PACK_QTY_MAX, Math.max(1, q));
}

export function guildWarChipPackChips(qty: number): number {
  return clampGuildWarChipPackQty(qty) * GUILD_WAR_CHIP_PACK_SIZE;
}

export function guildWarChipPackCost(qty: number): number {
  return clampGuildWarChipPackQty(qty) * GUILD_WAR_CHIP_PACK_GP;
}
