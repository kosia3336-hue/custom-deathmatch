let titanMemberId: string | null = null;

export function setLiveDummyMemberId(id: string | null): void {
  titanMemberId = id;
}

export function getLiveDummyMemberId(): string | null {
  return titanMemberId;
}

export function isLiveDummyMemberId(memberId: string | null | undefined): boolean {
  return !!titanMemberId && memberId === titanMemberId;
}
