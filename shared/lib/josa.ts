/**
 * 받침에 따라 조사를 고른다.
 *
 * 대기 문구가 닉네임 뒤에 '이' 를 고정으로 붙여 '나이 타일을 선택 중...',
 * '상대이 응답 중...' 처럼 읽혔다. 닉네임은 영문·숫자로 끝나기도 해서 읽는 소리
 * 기준으로 받침을 본다(Tom → 톰이, 7 → 칠이). 판단할 수 없는 글자(기호·이모지)로
 * 끝나면 '이(가)' 처럼 둘 다 적는다 — 틀린 조사보다 낫다.
 *
 * 클라이언트·서버가 함께 쓴다.
 */
export type JosaPair = '이/가' | '을/를' | '은/는' | '과/와' | '으로/로';

interface Tail {
  batchim: boolean;
  /** ㄹ 받침 — '으로/로' 에서는 받침이 있어도 '로' */
  rieul: boolean;
}

/* 숫자는 읽는 소리로: 영·일·삼·육·칠·팔 은 받침이 있고, 일·칠·팔 은 ㄹ 받침 */
const DIGIT_TAIL: Record<string, Tail> = {
  '0': { batchim: true, rieul: false },
  '1': { batchim: true, rieul: true },
  '2': { batchim: false, rieul: false },
  '3': { batchim: true, rieul: false },
  '4': { batchim: false, rieul: false },
  '5': { batchim: false, rieul: false },
  '6': { batchim: true, rieul: false },
  '7': { batchim: true, rieul: true },
  '8': { batchim: true, rieul: true },
  '9': { batchim: false, rieul: false },
};

/* 영문은 알파벳 이름으로 읽는다: 엘·엠·엔·알 만 받침이 있다 */
const LATIN_BATCHIM = new Set(['l', 'm', 'n', 'r']);
const LATIN_RIEUL = new Set(['l', 'r']);

function tailOf(word: string): Tail | null {
  const ch = word.trimEnd().slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return { batchim: jong !== 0, rieul: jong === 8 };
  }
  // 낱자 자음(ㅋㅋ·ㄹ)은 이름(키읔·리을)으로 읽어 받침이 있다. 낱자 모음은 없다.
  if (code >= 0x3131 && code <= 0x314e) return { batchim: true, rieul: code === 0x3139 };
  if (code >= 0x314f && code <= 0x3163) return { batchim: false, rieul: false };
  if (ch in DIGIT_TAIL) return DIGIT_TAIL[ch];
  const lower = ch.toLowerCase();
  if (lower >= 'a' && lower <= 'z') {
    return { batchim: LATIN_BATCHIM.has(lower), rieul: LATIN_RIEUL.has(lower) };
  }
  return null;
}

/** `josa('나', '이/가')` → `'나가'` */
export function josa(word: string, pair: JosaPair): string {
  const tail = tailOf(word);
  if (pair === '으로/로') {
    if (!tail) return `${word}(으)로`;
    return word + (tail.batchim && !tail.rieul ? '으로' : '로');
  }
  const [withBatchim, withoutBatchim] = pair.split('/') as [string, string];
  if (!tail) return `${word}${withBatchim}(${withoutBatchim})`;
  return word + (tail.batchim ? withBatchim : withoutBatchim);
}
