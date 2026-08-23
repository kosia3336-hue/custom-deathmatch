/** 길드 현판. 대시보드 정보 카드만. 목록은 `GuildListClient` 밝은 카드. */

import type { ReactNode } from 'react';

export function GuildBannerStyles() {
  return (
    <style>{`
      .guild-banner {
        position: relative;
        overflow: hidden;
        padding: 1.35rem 1.35rem 1.2rem;
        border-radius: var(--cdm-radius-xl);
        border: 1px solid color-mix(in srgb, var(--cdm-highlight) 55%, var(--cdm-border));
        box-shadow: var(--cdm-shadow-md), inset 0 0 0 1px color-mix(in srgb, var(--cdm-highlight) 28%, transparent);
        background:
          linear-gradient(180deg, var(--cdm-highlight) 0, var(--cdm-highlight) 3px, transparent 3px),
          radial-gradient(90% 80% at 0% 0%, color-mix(in srgb, var(--cdm-highlight) 28%, transparent), transparent 55%),
          radial-gradient(70% 70% at 100% 100%, color-mix(in srgb, var(--cdm-highlight) 16%, transparent), transparent 50%),
          repeating-linear-gradient(
            -32deg,
            transparent 0 11px,
            color-mix(in srgb, var(--cdm-fg-inverse) 5%, transparent) 11px 12px
          ),
          linear-gradient(155deg, var(--cdm-primary) 0%, var(--cdm-primary-strong) 48%, var(--title-midnight) 100%);
      }
      .guild-banner::after {
        content: '';
        position: absolute;
        left: 14%;
        right: 14%;
        bottom: 0;
        height: 3px;
        background: linear-gradient(90deg, transparent, var(--cdm-highlight), transparent);
        pointer-events: none;
      }
      .guild-banner-corner {
        position: absolute;
        width: 1.75rem;
        height: 1.75rem;
        color: var(--cdm-highlight);
        pointer-events: none;
      }
      .guild-banner-corner-tl { top: 0.55rem; left: 0.55rem; }
      .guild-banner-corner-tr { top: 0.55rem; right: 0.55rem; transform: scaleX(-1); }
      .guild-banner-corner-bl { bottom: 0.55rem; left: 0.55rem; transform: scaleY(-1); }
      .guild-banner-corner-br { bottom: 0.55rem; right: 0.55rem; transform: scale(-1); }
      .guild-banner-body {
        position: relative;
        display: flex;
        align-items: center;
        gap: 1.25rem;
      }
      .guild-banner-body[data-bare] {
        justify-content: center;
      }
      .guild-banner-copy {
        min-width: 0;
        flex: 1;
      }
      .guild-banner-body[data-bare] .guild-banner-copy {
        max-width: 36rem;
      }
      .guild-banner-title {
        display: flex;
        align-items: center;
        gap: 0.65rem;
      }
      .guild-banner-title h2 {
        margin: 0;
        min-width: 0;
        font-size: 1.7rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        line-height: 1.1;
        color: var(--cdm-fg-inverse);
        text-shadow: 0 1px 0 color-mix(in srgb, var(--title-midnight) 70%, transparent);
      }
      .guild-banner-lv {
        flex-shrink: 0;
        padding: 0.18rem 0.5rem;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--cdm-highlight) 55%, transparent);
        background: color-mix(in srgb, var(--title-midnight) 40%, transparent);
        color: var(--cdm-highlight-soft);
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.04em;
      }
      .guild-banner-flourish {
        flex: 1 1 2.5rem;
        min-width: 2.25rem;
        height: 14px;
        color: var(--cdm-highlight);
      }
      .guild-banner-plates {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
        margin-top: 0.85rem;
      }
      .guild-banner-body[data-bare] .guild-banner-plates {
        justify-content: center;
      }
      .guild-banner-plate {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.32rem 0.7rem 0.32rem 0.55rem;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--cdm-highlight) 50%, transparent);
        background: color-mix(in srgb, var(--title-midnight) 45%, transparent);
        color: var(--cdm-fg-inverse);
        font-size: 0.8125rem;
        font-weight: 700;
        line-height: 1;
      }
      .guild-banner-plate em {
        font-style: normal;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        color: var(--cdm-highlight-soft);
      }
      .guild-banner-plate svg {
        flex-shrink: 0;
        color: var(--cdm-highlight);
      }
      .guild-banner-motto {
        margin-top: 0.85rem;
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        padding: 0.55rem 0.75rem;
        border-radius: var(--cdm-radius-md);
        border: 1px solid color-mix(in srgb, var(--cdm-highlight) 28%, transparent);
        background: color-mix(in srgb, var(--cdm-fg-inverse) 10%, transparent);
        color: color-mix(in srgb, var(--cdm-fg-inverse) 88%, var(--cdm-highlight-soft));
        font-size: 0.875rem;
        line-height: 1.45;
      }
      .guild-banner-motto-edit {
        flex-direction: column;
        background: var(--cdm-bg);
        border-color: var(--cdm-border);
        color: var(--cdm-fg);
      }
      .guild-banner-edit {
        cursor: pointer;
        flex-shrink: 0;
        margin-left: auto;
        font-size: 11px;
        font-weight: 700;
        color: var(--cdm-highlight-soft);
        text-decoration: underline;
        text-underline-offset: 2px;
        background: none;
        border: 0;
        padding: 0;
      }
      .guild-banner-leave {
        position: relative;
        cursor: pointer;
        margin-top: 0.85rem;
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
        color: var(--cdm-accent-soft);
      }
      .guild-banner-leave:hover { text-decoration: underline; }
      .guild-banner-leave:disabled { opacity: 0.4; cursor: not-allowed; }
      .guild-banner-crest {
        flex-shrink: 0;
        width: 6.75rem;
        filter: drop-shadow(0 6px 10px color-mix(in srgb, var(--title-midnight) 55%, transparent));
      }
      .guild-banner-crest-metal {
        padding: 4px;
        background: linear-gradient(160deg, var(--cdm-highlight-soft), var(--cdm-highlight) 35%, var(--cdm-highlight-strong) 70%, var(--cdm-highlight-soft));
        clip-path: polygon(50% 0, 100% 16%, 100% 64%, 50% 100%, 0 64%, 0 16%);
      }
      .guild-banner-crest-inner {
        overflow: hidden;
        background: var(--title-midnight);
        clip-path: polygon(50% 0, 100% 16%, 100% 64%, 50% 100%, 0 64%, 0 16%);
      }
      .guild-banner-crest-inner img {
        display: block;
        width: 100%;
        height: 7.6rem;
        object-fit: cover;
      }
      @media (min-width: 640px) {
        .guild-banner {
          padding: 1.6rem 1.7rem 1.35rem;
        }
        .guild-banner-title h2 {
          font-size: 2rem;
        }
        .guild-banner-crest {
          width: 7.75rem;
        }
        .guild-banner-crest-inner img {
          height: 8.7rem;
        }
      }
    `}</style>
  );
}

export function BannerFlourish({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className="guild-banner-flourish"
      viewBox="0 0 96 14"
      aria-hidden
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M1 7h28l6-5 6 5 6-5 6 5h37"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="47" cy="7" r="2.1" fill="currentColor" />
    </svg>
  );
}

export function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M3 20V3h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3 10h8M11 3v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 3h6v6H3z" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function CrownIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 18 5 8l5.5 5L12 4l1.5 9L19 8l2 10H3zM4 20h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PeopleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GuildBannerCrest({ src, name }: { src: string; name: string }) {
  return (
    <div className="guild-banner-crest">
      <div className="guild-banner-crest-metal">
        <div className="guild-banner-crest-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${name} 길드`} />
        </div>
      </div>
    </div>
  );
}

export function GuildBannerFrame({ children }: { children: ReactNode }) {
  return (
    <section className="guild-banner">
      <CornerOrnament className="guild-banner-corner guild-banner-corner-tl" />
      <CornerOrnament className="guild-banner-corner guild-banner-corner-tr" />
      <CornerOrnament className="guild-banner-corner guild-banner-corner-bl" />
      <CornerOrnament className="guild-banner-corner guild-banner-corner-br" />
      {children}
    </section>
  );
}
