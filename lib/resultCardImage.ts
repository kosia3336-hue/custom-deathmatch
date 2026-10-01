/**
 * 전적 결과 카드 이미지(720×720 JPEG, 보통 40KB 안팎) — 공유 시트로 사진처럼 보낸다.
 *
 * 브라우저 캔버스로 그린다. 서버를 거치지 않아 누른 순간 곧바로 공유 시트를 열 수 있고,
 * 글꼴은 페이지가 이미 받아 둔 본문 글꼴(Pretendard)을 그대로 쓴다.
 * 들어가는 글자는 `resultCardContent`(lib/resultShare.ts) 가 정한다 — 링크·회원 ID·패는 없다.
 *
 * 형식: JPEG. PNG 는 그라데이션 배경이라 1080px 에 800KB 를 넘는다. WebP 가 더 작지만
 * 사파리는 캔버스에서 WebP 를 만들지 못하고(PNG 로 바뀜) 받는 앱마다 지원이 달라 JPEG 로 둔다.
 * 레이아웃은 1080 기준 좌표로 그리고 캔버스 배율로 720 에 맞춘다.
 */
import {
  resultCardContent,
  type ResultCardTone,
  type ResultCardVsPart,
  type ResultShareSummary,
} from './resultShare';

/** 내보내는 이미지 한 변(px) */
export const RESULT_CARD_SIZE = 720;
const JPEG_QUALITY = 0.9;

/** 그리기 좌표계(1080 기준) */
const LAYOUT = 1080;
const PAD = 96;
const CONTENT_WIDTH = LAYOUT - PAD * 2;

const TONE: Record<ResultCardTone, string> = {
  win: '#FFD166',
  draw: '#7DD3FC',
  other: '#A9AED6',
};
const WIN_BADGE_BG = '#FFD166';
const WIN_BADGE_FG = '#14142B';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** 폭에 맞을 때까지 글자를 줄이고, 최소 크기에서도 넘치면 말줄임한다. */
function drawFitted(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  { size, minSize, weight, color, family }: { size: number; minSize: number; weight: number; color: string; family: string },
) {
  let px = size;
  const setFont = () => {
    ctx.font = `${weight} ${px}px ${family}`;
  };
  setFont();
  while (px > minSize && ctx.measureText(text).width > CONTENT_WIDTH) {
    px -= 2;
    setFont();
  }
  let shown = text;
  while (shown.length > 1 && ctx.measureText(shown).width > CONTENT_WIDTH) {
    shown = shown.slice(0, -2) + '…';
  }
  ctx.fillStyle = color;
  ctx.fillText(shown, PAD, y);
}

/** '승' 배지 크기 — 글자 크기에 비례 */
const badgeSize = (px: number) => ({ gap: Math.round(px * 0.22), box: Math.round(px * 0.92) });

/**
 * '나 승 vs 상대' 줄. 승자 이름 뒤에 노란 '승' 배지를 붙인다.
 * 폭에 맞을 때까지 줄이고, 최소 크기에서도 넘치면 가장 긴 이름부터 말줄임한다.
 */
function drawVsLine(
  ctx: CanvasRenderingContext2D,
  parts: ResultCardVsPart[],
  y: number,
  { size, minSize, family }: { size: number; minSize: number; family: string },
) {
  const items = parts.map((p) => ({ ...p }));
  let px = size;
  const width = () => {
    ctx.font = `800 ${px}px ${family}`;
    const { gap, box } = badgeSize(px);
    return items.reduce(
      (sum, p) => sum + ctx.measureText(p.text).width + (p.kind === 'name' && p.won ? gap + box : 0),
      0,
    );
  };
  while (px > minSize && width() > CONTENT_WIDTH) px -= 2;
  while (width() > CONTENT_WIDTH) {
    const longest = items
      .filter((p) => p.kind === 'name' && p.text.length > 2)
      .sort((a, b) => b.text.length - a.text.length)[0];
    if (!longest) break;
    longest.text = longest.text.replace(/…$/, '').slice(0, -1) + '…';
  }

  ctx.font = `800 ${px}px ${family}`;
  const { gap, box } = badgeSize(px);
  let x = PAD;
  for (const p of items) {
    ctx.fillStyle = p.kind === 'name' ? '#FFFFFF' : '#C9CBF5';
    ctx.font = `800 ${px}px ${family}`;
    ctx.fillText(p.text, x, y);
    x += ctx.measureText(p.text).width;
    if (p.kind === 'name' && p.won) {
      const top = y - px * 0.36 - box / 2;
      ctx.fillStyle = WIN_BADGE_BG;
      roundRect(ctx, x + gap, top, box, box, Math.round(box * 0.24));
      ctx.fill();
      ctx.fillStyle = WIN_BADGE_FG;
      ctx.font = `800 ${Math.round(px * 0.6)}px ${family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('승', x + gap + box / 2, top + box / 2 + px * 0.03);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      x += gap + box;
    }
  }
}

export async function renderResultCardFile(summary: ResultShareSummary): Promise<File> {
  const content = resultCardContent(summary);
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  await Promise.all(
    [500, 800].map((w) => document.fonts?.load(`${w} 64px ${family}`).catch(() => undefined)),
  );

  const canvas = document.createElement('canvas');
  canvas.width = RESULT_CARD_SIZE;
  canvas.height = RESULT_CARD_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 쓸 수 없습니다.');
  ctx.scale(RESULT_CARD_SIZE / LAYOUT, RESULT_CARD_SIZE / LAYOUT);

  const bg = ctx.createLinearGradient(0, 0, LAYOUT, LAYOUT);
  bg.addColorStop(0, '#14142B');
  bg.addColorStop(0.55, '#1E1E3F');
  bg.addColorStop(1, '#3A2A6B');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, LAYOUT, LAYOUT);

  // 머리: 앱 아이콘 + CUSTOM DEATHMATCH, 랭크전이면 오른쪽에 금색 '랭크전'
  const icon = await loadImage('/icon.png');
  const iconSize = 72;
  const headerMid = PAD + iconSize / 2;
  if (icon) {
    ctx.save();
    roundRect(ctx, PAD, PAD, iconSize, iconSize, 16);
    ctx.clip();
    ctx.drawImage(icon, PAD, PAD, iconSize, iconSize);
    ctx.restore();
  }
  ctx.textBaseline = 'middle';
  ctx.font = `500 30px ${family}`;
  ctx.fillStyle = '#A5A8E8';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText('CUSTOM DEATHMATCH', icon ? PAD + iconSize + 24 : PAD, headerMid);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  if (content.isRanked) {
    ctx.font = `800 30px ${family}`;
    const label = '랭크전';
    const pillW = ctx.measureText(label).width + 52;
    const pillH = 60;
    const pillX = LAYOUT - PAD - pillW;
    roundRect(ctx, pillX, headerMid - pillH / 2, pillW, pillH, pillH / 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFD166';
    ctx.stroke();
    ctx.fillStyle = '#FFD166';
    ctx.textAlign = 'center';
    ctx.fillText(label, pillX + pillW / 2, headerMid + 1);
    ctx.textAlign = 'left';
  }

  // 본문: 게임명 → 결과 → 나 vs 상대(승자에 '승')
  ctx.textBaseline = 'alphabetic';
  drawFitted(ctx, content.gameName, 420, { size: 56, minSize: 36, weight: 500, color: '#C9CBF5', family });
  drawFitted(ctx, content.resultLabel, 650, { size: 220, minSize: 120, weight: 800, color: TONE[content.tone], family });
  if (content.vsParts.length > 0) {
    drawVsLine(ctx, content.vsParts, 780, { size: 68, minSize: 40, family });
  }

  // 바닥: 일시 · 플레이 시간 · 턴
  drawFitted(ctx, content.meta, LAYOUT - PAD, { size: 38, minSize: 28, weight: 500, color: '#A5A8E8', family });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) throw new Error('이미지를 만들지 못했습니다.');
  return new File([blob], `custom-deathmatch-result-${Date.now()}.jpg`, { type: 'image/jpeg' });
}
