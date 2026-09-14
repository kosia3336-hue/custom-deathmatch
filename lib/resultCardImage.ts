/**
 * 전적 결과 카드 이미지(1080×1080 PNG) — 공유 시트로 사진처럼 보낸다.
 *
 * 브라우저 캔버스로 그린다. 서버를 거치지 않아 누른 순간 곧바로 공유 시트를 열 수 있고,
 * 글꼴은 페이지가 이미 받아 둔 본문 글꼴(Pretendard)을 그대로 쓴다.
 * 들어가는 글자는 `resultCardContent`(lib/resultShare.ts) 가 정한다 — 링크·회원 ID·패는 없다.
 */
import { resultCardContent, type ResultCardTone, type ResultShareSummary } from './resultShare';

export const RESULT_CARD_SIZE = 1080;

const PAD = 96;
const CONTENT_WIDTH = RESULT_CARD_SIZE - PAD * 2;

const TONE: Record<ResultCardTone, string> = {
  win: '#FFD166',
  draw: '#7DD3FC',
  other: '#A9AED6',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
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

  const bg = ctx.createLinearGradient(0, 0, RESULT_CARD_SIZE, RESULT_CARD_SIZE);
  bg.addColorStop(0, '#14142B');
  bg.addColorStop(0.55, '#1E1E3F');
  bg.addColorStop(1, '#3A2A6B');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, RESULT_CARD_SIZE, RESULT_CARD_SIZE);

  // 머리: 앱 아이콘 + CUSTOM DEATHMATCH
  const icon = await loadImage('/icon.png');
  const iconSize = 72;
  if (icon) {
    ctx.save();
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(PAD, PAD, iconSize, iconSize, 16);
    else ctx.rect(PAD, PAD, iconSize, iconSize);
    ctx.clip();
    ctx.drawImage(icon, PAD, PAD, iconSize, iconSize);
    ctx.restore();
  }
  ctx.textBaseline = 'middle';
  ctx.font = `500 30px ${family}`;
  ctx.fillStyle = '#A5A8E8';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
  ctx.fillText('CUSTOM DEATHMATCH', icon ? PAD + iconSize + 24 : PAD, PAD + iconSize / 2);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

  // 본문: 게임명 → 결과 → 나 vs 상대
  ctx.textBaseline = 'alphabetic';
  drawFitted(ctx, content.gameName, 420, { size: 56, minSize: 36, weight: 500, color: '#C9CBF5', family });
  drawFitted(ctx, content.resultLabel, 650, { size: 220, minSize: 120, weight: 800, color: TONE[content.tone], family });
  if (content.vsLine) {
    drawFitted(ctx, content.vsLine, 780, { size: 68, minSize: 40, weight: 800, color: '#FFFFFF', family });
  }

  // 바닥: 일시 · 플레이 시간 · 턴
  drawFitted(ctx, content.meta, RESULT_CARD_SIZE - PAD, { size: 38, minSize: 28, weight: 500, color: '#A5A8E8', family });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('이미지를 만들지 못했습니다.');
  return new File([blob], `custom-deathmatch-result-${Date.now()}.png`, { type: 'image/png' });
}
