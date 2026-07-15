/**
 * 가벼운 자체 마크다운 렌더러 — 공지사항 본문 전용.
 *
 * 정의: docs/v2/20_notices.md §20.5.1
 *
 * 외부 라이브러리(react-markdown 등) 없이, 화이트리스트 기반으로 안전하게 렌더한다.
 * 향후 공지 본문이 복잡해지면 react-markdown + rehype-sanitize 로 마이그레이션 가능.
 *
 * ── 허용 ──────────────────────────────────────────────
 *   - 헤딩 H3 / H4 / H5 / H6 (`### ~ ######`)
 *   - 단락 (빈 줄 구분)
 *   - 굵게 (`**텍스트**`), 기울임 (`*텍스트*`), 취소선 (`~~텍스트~~`)
 *   - 코드 인라인 (`` `code` ``)
 *   - 링크 `[text](https://...)` — http(s) 만 허용 (javascript:, data: 등 차단)
 *   - 리스트: `- item`, `* item`, `1. item`
 *   - 인용: `> ...`
 *   - 코드 블록 ``` ``` ``` ```
 *   - 수평선 `---`
 *
 * ── 차단 ──────────────────────────────────────────────
 *   - 원시 HTML (escape)
 *   - <iframe>, <script> (이미지는 마크다운 ![alt](url) http(s) 만 허용)
 *   - H1, H2 (페이지 제목과 충돌)
 *   - 색상 인라인 스타일
 *   - data: / javascript: / vbscript: URL
 */

import * as React from 'react';

interface MarkdownViewProps {
  source: string;
  className?: string;
}

/**
 * 저장된 마크다운에 섞여 들어온 HTML 엔티티(&lt; &gt; &amp; 등)를 실제 문자로 복원.
 * TipTap 에디터의 마크다운 직렬화가 `<` `>` 를 엔티티로 이스케이프해 저장하는 경우가 있어,
 * 렌더 시 그대로 &lt; 로 보이던 문제를 해결한다. (&amp; 는 마지막에 처리)
 */
function decodeEntities(input: string): string {
  return (
    input
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      // TipTap 마크다운 직렬화가 만든 하드브레이크(행 끝 \\) → 일반 줄바꿈
      .replace(/\\\n/g, '\n')
      // 이스케이프된 마크다운 특수문자(\* \_ \[ 등) → 원래 문자
      .replace(/\\([\\`*_{}\[\]()#+\-.!>~|])/g, '$1')
  );
}

export function MarkdownView({ source, className }: MarkdownViewProps) {
  const blocks = React.useMemo(() => parseBlocks(decodeEntities(source ?? '')), [source]);
  return (
    <div className={className}>
      {blocks.map((block, i) => (
        <BlockNode key={i} block={block} />
      ))}
    </div>
  );
}

/** 본문에서 첫 N자(서식 제거)만 뽑는다. SEO description 용. */
export function extractPlainText(source: string, limit = 100): string {
  const text = (source ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_~>#-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit).trimEnd() + '…';
}

// ────────────────────────────────────────────────────────────────────
// 파서
// ────────────────────────────────────────────────────────────────────

type Block =
  | { kind: 'h'; level: 3 | 4 | 5 | 6; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[]; start: number }
  | { kind: 'pre'; code: string; lang?: string }
  | { kind: 'hr' };

function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    // 코드 블록 ``` ... ```
    const fence = /^```([a-zA-Z0-9_-]*)\s*$/.exec(line);
    if (fence) {
      const lang = fence[1] || undefined;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: 'pre', code: buf.join('\n'), lang });
      continue;
    }

    // 수평선
    if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    // 헤딩 H3 ~ H6 (H1/H2 는 차단)
    const h = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const text = h[2];
      if (lvl <= 2) {
        blocks.push({ kind: 'h', level: 3, text });
      } else {
        blocks.push({ kind: 'h', level: lvl as 3 | 4 | 5 | 6, text });
      }
      i++;
      continue;
    }

    // 인용 (연속 라인 묶음)
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ kind: 'quote', text: buf.join('\n') });
      continue;
    }

    // 순서 없는 리스트
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    // 순서 있는 리스트 — 시작 번호 유지 (복붙 시 1./2./3. 이 각각 분리돼도 이어짐)
    if (/^\s*\d+\.\s+/.test(line)) {
      const start = Number(/^\s*(\d+)\./.exec(line)?.[1] ?? 1) || 1;
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items, start });
      continue;
    }

    // 일반 단락 (빈 줄 만나기 전까지 묶기)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^```/.test(lines[i]) &&
      !/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: 'p', text: buf.join('\n') });
  }

  return blocks;
}

// ────────────────────────────────────────────────────────────────────
// 렌더 — 블록
// ────────────────────────────────────────────────────────────────────

function BlockNode({ block }: { block: Block }) {
  switch (block.kind) {
    case 'h': {
      const Tag = (`h${block.level}` as unknown) as keyof React.JSX.IntrinsicElements;
      const cls = HEADING_CLASS[block.level];
      return <Tag className={cls}><InlineNode text={block.text} /></Tag>;
    }
    case 'p':
      return (
        <p className="my-3 whitespace-pre-wrap text-[15px] leading-7 text-cdm-fg wrap-break-word">
          <InlineNode text={block.text} />
        </p>
      );
    case 'quote':
      return (
        <blockquote className="my-3 border-l-2 border-cdm-border-strong bg-cdm-bg-elev-1 px-3 py-2 text-cdm-fg-muted">
          <p className="whitespace-pre-wrap text-[15px] leading-7">
            <InlineNode text={block.text} />
          </p>
        </blockquote>
      );
    case 'ul':
      return (
        <ul className="my-3 list-disc pl-5 text-[15px] leading-7 text-cdm-fg">
          {block.items.map((it, i) => (
            <li key={i}><InlineNode text={it} /></li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol start={block.start} className="my-3 list-decimal pl-5 text-[15px] leading-7 text-cdm-fg">
          {block.items.map((it, i) => (
            <li key={i}><InlineNode text={it} /></li>
          ))}
        </ol>
      );
    case 'pre':
      return (
        <pre className="my-3 overflow-x-auto rounded-cdm-md bg-cdm-bg-elev-2 p-3 text-[13px] leading-6 text-cdm-fg">
          <code>{block.code}</code>
        </pre>
      );
    case 'hr':
      return <hr className="my-5 border-cdm-border" />;
  }
}

const HEADING_CLASS: Record<3 | 4 | 5 | 6, string> = {
  3: 'mt-5 mb-2 text-lg font-bold text-cdm-fg',
  4: 'mt-4 mb-2 text-base font-bold text-cdm-fg',
  5: 'mt-3 mb-1 text-sm font-bold text-cdm-fg',
  6: 'mt-3 mb-1 text-sm font-semibold text-cdm-fg-muted',
};

// ────────────────────────────────────────────────────────────────────
// 렌더 — 인라인
//   순서: 코드 인라인 → 링크 → 굵게 → 기울임 → 취소선
// ────────────────────────────────────────────────────────────────────

type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'img'; alt: string; src: string }
  | { kind: 'strong'; children: InlineToken[] }
  | { kind: 'em'; children: InlineToken[] }
  | { kind: 'del'; children: InlineToken[] };

function InlineNode({ text }: { text: string }) {
  const tokens = parseInline(text);
  return <>{tokens.map((t, i) => <TokenView key={i} token={t} />)}</>;
}

function TokenView({ token }: { token: InlineToken }) {
  switch (token.kind) {
    case 'text':
      return <>{token.text}</>;
    case 'code':
      return (
        <code className="rounded-[4px] bg-cdm-bg-elev-2 px-1 py-0.5 font-mono text-[0.9em] text-cdm-fg">
          {token.text}
        </code>
      );
    case 'img':
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={token.src}
          alt={token.alt}
          loading="lazy"
          className="my-2 inline-block h-auto max-w-full rounded-cdm-md border border-cdm-border"
        />
      );
    case 'link':
      return (
        <a
          href={token.href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cdm-primary underline underline-offset-2 hover:text-cdm-primary-strong break-all"
        >
          {token.text}
        </a>
      );
    case 'strong':
      return (
        <strong className="font-semibold text-cdm-fg">
          {token.children.map((c, i) => <TokenView key={i} token={c} />)}
        </strong>
      );
    case 'em':
      return (
        <em className="italic">
          {token.children.map((c, i) => <TokenView key={i} token={c} />)}
        </em>
      );
    case 'del':
      return (
        <del className="text-cdm-fg-muted">
          {token.children.map((c, i) => <TokenView key={i} token={c} />)}
        </del>
      );
  }
}

/**
 * 단순 인라인 파서.
 * 토큰 우선순위: code 인라인 > 링크 > strong > em > del > text.
 * 입력은 escape 가 필요 없다 — JSX 가 자동으로 처리한다.
 */
function parseInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) {
      tokens.push({ kind: 'text', text: buf });
      buf = '';
    }
  };

  while (i < input.length) {
    const ch = input[i];

    // 코드 인라인 `code`
    if (ch === '`') {
      const end = input.indexOf('`', i + 1);
      if (end > i) {
        flush();
        tokens.push({ kind: 'code', text: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // 이미지 ![alt](url)
    if (ch === '!' && input[i + 1] === '[') {
      const close = input.indexOf(']', i + 2);
      if (close > i && input[close + 1] === '(') {
        const urlEnd = input.indexOf(')', close + 2);
        if (urlEnd > close) {
          const alt = input.slice(i + 2, close);
          const src = input.slice(close + 2, urlEnd).trim();
          if (isSafeUrl(src)) {
            flush();
            tokens.push({ kind: 'img', alt, src });
            i = urlEnd + 1;
            continue;
          }
        }
      }
    }

    // 링크 [text](url)
    if (ch === '[') {
      const close = input.indexOf(']', i + 1);
      if (close > i && input[close + 1] === '(') {
        const urlEnd = input.indexOf(')', close + 2);
        if (urlEnd > close) {
          const text = input.slice(i + 1, close);
          const href = input.slice(close + 2, urlEnd).trim();
          if (isSafeUrl(href)) {
            flush();
            tokens.push({ kind: 'link', text, href });
            i = urlEnd + 1;
            continue;
          }
        }
      }
    }

    // ** 굵게 **
    if (ch === '*' && input[i + 1] === '*') {
      const end = input.indexOf('**', i + 2);
      if (end > i + 1) {
        flush();
        tokens.push({ kind: 'strong', children: parseInline(input.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // ~~ 취소선 ~~
    if (ch === '~' && input[i + 1] === '~') {
      const end = input.indexOf('~~', i + 2);
      if (end > i + 1) {
        flush();
        tokens.push({ kind: 'del', children: parseInline(input.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }

    // * 기울임 * (단, **는 위에서 처리됨)
    if (ch === '*') {
      const end = input.indexOf('*', i + 1);
      if (end > i && input[end + 1] !== '*' && input[i - 1] !== '*') {
        flush();
        tokens.push({ kind: 'em', children: parseInline(input.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    buf += ch;
    i++;
  }

  flush();
  return tokens;
}

/** http(s) 만 허용. javascript: / data: / vbscript: 차단. */
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true;
  return /^https?:\/\//i.test(trimmed);
}
