/**
 * 상단 바 한 칸에 '내 자리' 와 '지금 무슨 단계인가' 를 같이 적는다.
 *
 * 단계만 적으면 '선 플레이어 베팅' 이 떠도 그게 나인지 상대인지 알 수가 없다.
 * 선/후가 갈리는 판은 대개 상대의 수를 보고 내 수를 정하는 구조라, 내 자리를
 * 모르면 공개된 정보가 누구 것인지도 못 읽는다. 흑과백2에서 실제로 그 신고가
 * 들어왔다 — '선·후의 흑백을 못 본다'.
 *
 * 자리는 앞에 두고, 긴 단계 안내는 공통 상단 바에서 줄바꿈해 전체를 표시한다.
 *
 * 쓰는 법
 *   seatStage('후', '내 차례')   →  '후 · 내 차례'
 *   seatStage(null, '라운드 정산') →  '라운드 정산'   (관전자·자리 없는 판)
 */
export function seatStage(
  seat: string | null | undefined,
  stage: string | undefined,
): string | undefined {
  if (!stage) return seat ?? undefined;
  return seat ? `${seat} · ${stage}` : stage;
}

/**
 * 차례가 오가는 판의 단계 문구. 끝났으면 '종료', 내 차례면 '내 차례'.
 * 관전자는 누구 차례인지만 알면 되므로 자리 이름을 그대로 쓴다.
 */
export function turnStage(opts: {
  finished: boolean;
  isSpectator: boolean;
  isMyTurn: boolean;
  /** 관전자에게 보여 줄 문구 (예: '선 제출') */
  spectatorStage?: string;
}): string {
  if (opts.finished) return '종료';
  if (opts.isSpectator) return opts.spectatorStage ?? '진행 중';
  return opts.isMyTurn ? '내 차례' : '상대 차례';
}

/**
 * 동시 제출 판의 단계 문구.
 *
 * 동시에 내는 판에서는 '내 차례' 가 뜻이 없다 — 둘 다 차례다. 대신 내가 이미
 * 냈는지를 알려 준다. 그게 이 단계에서 사람이 실제로 궁금해하는 것이다.
 */
export function submitStage(opts: {
  finished: boolean;
  isSpectator: boolean;
  submitted: boolean;
  /** 아직 안 냈을 때 보여 줄 문구 (예: '카드 선택') */
  pending: string;
}): string {
  if (opts.finished) return '종료';
  if (opts.isSpectator) return opts.pending;
  return opts.submitted ? '상대 대기' : opts.pending;
}

/** 표시 직전에 차례를 괄호로 묶는다. 이미 괄호가 있으면 중복하지 않는다. */
export function formatTurnLabel(label: string): string {
  return label
    .replace(/(?<!\()(공동 차례|내 차례|상대 차례)(?!\))/g, '($1)')
    .replace(/\) · /g, ') ');
}
