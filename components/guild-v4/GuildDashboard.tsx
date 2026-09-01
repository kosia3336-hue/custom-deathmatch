'use client';

import Link from 'next/link';
import { useEffect, useState, Fragment } from 'react';
import { GuildIdentityCard, GuildJoinRequestsSection, GuildMembersSection, GuildOpsSection } from './GuildClient';
import { UnreadBadge } from '@/components/cdm';
import { GuildConfirmModal, type GuildConfirm } from './GuildConfirmModal';
import { GuildChatModal, GuildChatSync } from './GuildChatClient';
import { GuildNoticeSection } from './GuildNotices';
import { GuildShopSection, GuildNameChangeModal } from './GuildShop';
import { GuildContribSection } from './GuildContrib';
import { GuildInvestSection } from './GuildInvest';
import { GuildGrantSection } from './GuildGrant';
import { GuildListPanel } from './GuildListClient';
import { useGuildDevApi } from './useGuildDevApi';
import { useGuildDevStore } from './store';
import { Modal } from '@/components/cdm/Modal';
import { useGuildChatStore } from '@/stores/guildChat';
import type { DevGuildMe } from './dummy';
import { DEV_TILE_LABEL, type DevTileId } from './tiles';

export function GuildDashboard({ me }: { me: DevGuildMe }) {
  const { my, busy, act, hydrated, meId, guilds } = useGuildDevApi(me);
  const [pending, setPending] = useState<GuildConfirm | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [opsOpen, setOpsOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [nameChangeOpen, setNameChangeOpen] = useState(false);
  const [scoutOpen, setScoutOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);
  const [investOpen, setInvestOpen] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const chatLen = useGuildChatStore((s) => s.messages.length);
  const lastSeen = useGuildChatStore((s) => s.lastSeenMsgCount);
  const tileOrder = useGuildDevStore((s) => s.tileOrder);
  const rankCard = useGuildDevStore((s) => s.rankCard);

  useEffect(() => {
    if (my.role !== 'owner' && my.role !== 'vice_owner') setOpsOpen(false);
  }, [my.role]);

  if (!hydrated) {
    return <p className="text-sm text-cdm-fg-muted">불러오는 중…</p>;
  }
  if (!my.guild) {
    return <GuildListPanel guilds={guilds} my={my} busy={busy} act={act} variant="page" />;
  }
  const unread = chatOpen ? 0 : Math.max(0, chatLen - lastSeen);
  const joinBadge = my.pendingRequests.length;
  const canManage = my.role === 'owner' || my.role === 'vice_owner';

  return (
    <>
      <GuildChatSync enabled memberId={meId} guildId={my.guild.id} />
      <GuildIdentityCard my={my} busy={busy} act={act} askConfirm={setPending} />

      <ul className="guild-dash-grid">
        {tileOrder.map((id) => {
          const tile = dashTile(id, {
            canManage,
            joinBadge,
            unread,
            onMembers: () => setMembersOpen(true),
            onJoin: () => setJoinOpen(true),
            onOps: () => setOpsOpen(true),
            onChat: () => setChatOpen(true),
            onNotice: () => setNoticesOpen(true),
            onShop: () => setShopOpen(true),
            onList: () => setListOpen(true),
            onContrib: () => setContribOpen(true),
            onInvest: () => setInvestOpen(true),
            onGrant: () => setGrantOpen(true),
          });
          return tile ? <Fragment key={id}>{tile}</Fragment> : null;
        })}
      </ul>

      <Modal
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        title="길드원"
        size="lg"
        closeOnEscape={!pending}
        className="guild-members-modal-panel"
      >
        <div className="guild-members-modal-body">
          <GuildMembersSection
            my={my}
            myMemberId={meId}
            busy={busy}
            act={act}
            askConfirm={setPending}
          />
        </div>
      </Modal>

      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="가입 신청"
        size="md"
        closeOnEscape={!pending}
        className="guild-members-modal-panel"
      >
        <div className="guild-members-modal-body">
          <GuildJoinRequestsSection my={my} busy={busy} act={act} />
        </div>
      </Modal>

      <Modal
        open={opsOpen}
        onClose={() => setOpsOpen(false)}
        title="운영"
        size="md"
        closeOnEscape={!pending}
        className="guild-members-modal-panel"
      >
        <div className="guild-members-modal-body">
          <GuildOpsSection
            my={my}
            myMemberId={meId}
            busy={busy}
            act={act}
            askConfirm={setPending}
          />
        </div>
      </Modal>

      <Modal
        open={noticesOpen}
        onClose={() => setNoticesOpen(false)}
        title="공지"
        size="lg"
        closeOnEscape={!pending}
        className="guild-members-modal-panel"
      >
        <div className="guild-members-modal-body">
          <GuildNoticeSection my={my} busy={busy} act={act} />
        </div>
      </Modal>

      <Modal
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        title="상점"
        size="xl"
        closeOnEscape={!pending && !nameChangeOpen && !scoutOpen}
        className="guild-shop-modal-panel"
      >
        <div className="guild-shop-modal-body">
          <GuildShopSection
            my={my}
            busy={busy}
            act={act}
            askConfirm={setPending}
            onBuyNameChange={() => setNameChangeOpen(true)}
            onScoutOpenChange={setScoutOpen}
            rankCard={rankCard}
          />
        </div>
      </Modal>

      <Modal
        open={investOpen}
        onClose={() => setInvestOpen(false)}
        title="투자"
        size="md"
        closeOnEscape={!pending}
        className="guild-members-modal-panel"
      >
        <div className="guild-members-modal-body">
          <GuildInvestSection
            my={my}
            myMemberId={meId}
            busy={busy}
            act={act}
            askConfirm={setPending}
          />
        </div>
      </Modal>

      <Modal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="CDP 지급"
        size="md"
        closeOnEscape={!pending}
        className="guild-members-modal-panel"
      >
        <div className="guild-members-modal-body">
          <GuildGrantSection
            my={my}
            myMemberId={meId}
            busy={busy}
            act={act}
            askConfirm={setPending}
          />
        </div>
      </Modal>

      <Modal
        open={contribOpen}
        onClose={() => setContribOpen(false)}
        title="공헌도"
        size="md"
        closeOnEscape={!pending}
        className="guild-members-modal-panel"
      >
        <div className="guild-members-modal-body">
          <GuildContribSection my={my} myMemberId={meId} />
        </div>
      </Modal>

      <Modal
        open={listOpen}
        onClose={() => setListOpen(false)}
        title="랭킹"
        size="xl"
        closeOnEscape={!pending}
        className="guild-shop-modal-panel"
      >
        <div className="guild-shop-modal-body">
          <GuildListPanel guilds={guilds} my={my} busy={busy} act={act} variant="modal" />
        </div>
      </Modal>

      <GuildChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        guildName={my.guild.name}
        markUrl={my.guild.markUrl}
      />
      <GuildConfirmModal pending={pending} busy={busy} onClose={() => setPending(null)} />
      <GuildNameChangeModal
        open={nameChangeOpen}
        currentName={my.guild.name}
        busy={busy}
        onClose={() => setNameChangeOpen(false)}
        onSubmit={(name) => act({ action: 'update_name', name }, '길드명을 변경했습니다.')}
      />

      <style>{`
        .guild-dash-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .guild-dash-grid > li {
          min-width: 0;
        }
        .guild-members-modal-panel {
          max-height: min(40rem, calc(100dvh - 4rem));
        }
        .guild-members-modal-body {
          max-height: min(28rem, calc(100dvh - 12rem));
          overflow-y: auto;
        }
        .guild-shop-modal-panel {
          max-height: min(48rem, calc(100dvh - 3rem));
        }
        .guild-shop-modal-body {
          max-height: min(36rem, calc(100dvh - 10rem));
          overflow-y: auto;
        }
        .guild-dash-tile {
          appearance: none;
          position: relative;
          display: flex;
          width: 100%;
          height: auto;
          aspect-ratio: 1;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.6rem;
          overflow: hidden;
          border: 1px solid var(--cdm-border);
          border-radius: var(--cdm-radius-lg);
          background: var(--cdm-bg);
          box-shadow: var(--cdm-shadow-sm);
          color: var(--cdm-fg);
          font: inherit;
          font-size: 0.75rem;
          font-weight: 700;
          line-height: 1.2;
          text-decoration: none;
          cursor: pointer;
          text-align: center;
          user-select: none;
          transition: transform var(--cdm-duration-fast) var(--cdm-ease-out),
            box-shadow var(--cdm-duration-fast) var(--cdm-ease-out),
            border-color var(--cdm-duration-fast) var(--cdm-ease-out);
        }
        .guild-dash-tile::before {
          content: '';
          position: absolute;
          top: 0;
          left: 18%;
          right: 18%;
          height: 3px;
          border-radius: 0 0 4px 4px;
          background: var(--cdm-border-strong);
        }
        .guild-dash-tile:hover {
          transform: translateY(-2px);
          border-color: var(--cdm-border-strong);
          box-shadow: var(--cdm-shadow-md);
        }
        .guild-dash-tile[data-tone='members'] {
          background: linear-gradient(180deg, color-mix(in srgb, var(--cdm-primary-soft) 88%, white) 0%, var(--cdm-bg) 100%);
          border-color: color-mix(in srgb, var(--cdm-primary) 28%, var(--cdm-border));
        }
        .guild-dash-tile[data-tone='contrib'] {
          background: linear-gradient(180deg, color-mix(in srgb, var(--cdm-highlight-soft) 88%, white) 0%, var(--cdm-bg) 100%);
          border-color: color-mix(in srgb, var(--cdm-highlight) 28%, var(--cdm-border));
        }
        .guild-dash-tile[data-tone='invest'] {
          background: linear-gradient(180deg, color-mix(in srgb, var(--cdm-success-soft) 70%, var(--cdm-highlight-soft)) 0%, var(--cdm-bg) 100%);
          border-color: color-mix(in srgb, var(--cdm-success) 28%, var(--cdm-border));
        }
        .guild-dash-tile[data-tone='grant'] {
          background: linear-gradient(180deg, color-mix(in srgb, var(--cdm-info-soft) 88%, white) 0%, var(--cdm-bg) 100%);
          border-color: color-mix(in srgb, var(--cdm-info) 28%, var(--cdm-border));
        }
        .guild-dash-tile[data-tone='join'] {
          background: linear-gradient(180deg, color-mix(in srgb, var(--cdm-accent-soft) 88%, white) 0%, var(--cdm-bg) 100%);
          border-color: color-mix(in srgb, var(--cdm-accent) 28%, var(--cdm-border));
        }
        .guild-dash-tile[data-tone='chat'] {
          background: linear-gradient(180deg, color-mix(in srgb, var(--cdm-info-soft) 88%, white) 0%, var(--cdm-bg) 100%);
          border-color: color-mix(in srgb, var(--cdm-info) 28%, var(--cdm-border));
        }
        .guild-dash-tile[data-tone='shop'] {
          background: linear-gradient(180deg, color-mix(in srgb, var(--cdm-highlight-soft) 90%, white) 0%, var(--cdm-bg) 100%);
          border-color: color-mix(in srgb, var(--cdm-highlight) 32%, var(--cdm-border));
        }
        .guild-dash-tile[data-tone='ops'] {
          background: linear-gradient(180deg, var(--cdm-bg-elev-2) 0%, var(--cdm-bg) 100%);
          border-color: var(--cdm-border-strong);
        }
        .guild-dash-tile[data-tone='notice'] {
          background: linear-gradient(180deg, color-mix(in srgb, var(--cdm-success-soft) 88%, white) 0%, var(--cdm-bg) 100%);
          border-color: color-mix(in srgb, var(--cdm-success) 28%, var(--cdm-border));
        }
        .guild-dash-tile[data-tone='list'] {
          background: linear-gradient(180deg, var(--cdm-bg-elev-1) 0%, var(--cdm-bg) 100%);
        }
        .guild-dash-tile[data-tone='members']::before { background: var(--cdm-primary); }
        .guild-dash-tile[data-tone='contrib']::before { background: var(--cdm-highlight); }
        .guild-dash-tile[data-tone='invest']::before { background: var(--cdm-success); }
        .guild-dash-tile[data-tone='grant']::before { background: var(--cdm-info); }
        .guild-dash-tile[data-tone='join']::before { background: var(--cdm-accent); }
        .guild-dash-tile[data-tone='chat']::before { background: var(--cdm-info); }
        .guild-dash-tile[data-tone='shop']::before { background: var(--cdm-highlight); }
        .guild-dash-tile[data-tone='ops']::before { background: var(--cdm-fg-muted); }
        .guild-dash-tile[data-tone='notice']::before { background: var(--cdm-success); }
        .guild-dash-tile[data-tone='list']::before { background: var(--cdm-fg-subtle); }
        .guild-dash-icon {
          display: flex;
          width: 2.25rem;
          height: 2.25rem;
          align-items: center;
          justify-content: center;
          border-radius: var(--cdm-radius-md);
          background: rgb(255 255 255 / 0.7);
        }
        .guild-dash-icon svg {
          width: 18px;
          height: 18px;
        }
        .guild-dash-tile[data-tone='members'] .guild-dash-icon { color: var(--cdm-primary); }
        .guild-dash-tile[data-tone='contrib'] .guild-dash-icon { color: var(--cdm-highlight-strong); }
        .guild-dash-tile[data-tone='invest'] .guild-dash-icon { color: var(--cdm-success); }
        .guild-dash-tile[data-tone='grant'] .guild-dash-icon { color: var(--cdm-info); }
        .guild-dash-tile[data-tone='join'] .guild-dash-icon { color: var(--cdm-accent); }
        .guild-dash-tile[data-tone='chat'] .guild-dash-icon { color: var(--cdm-info); }
        .guild-dash-tile[data-tone='shop'] .guild-dash-icon { color: var(--cdm-highlight-strong); }
        .guild-dash-tile[data-tone='ops'] .guild-dash-icon { color: var(--cdm-fg); }
        .guild-dash-tile[data-tone='notice'] .guild-dash-icon { color: var(--cdm-success); }
        .guild-dash-tile[data-tone='list'] .guild-dash-icon { color: var(--cdm-fg-muted); }
        @media (min-width: 640px) {
          .guild-dash-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }
          .guild-dash-tile {
            font-size: 0.9375rem;
          }
          .guild-dash-icon {
            width: 3rem;
            height: 3rem;
          }
          .guild-dash-icon svg {
            width: 24px;
            height: 24px;
          }
        }
      `}</style>
    </>
  );
}

const ICON_GUILD =
  'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75';
const ICON_CONTRIB = 'M3 3v18h18M7 16v2M12 11v7M17 7v11';
const ICON_INVEST =
  'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';
const ICON_GRANT =
  'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z';
const ICON_JOIN =
  'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M20 8v6M23 11h-6';
const ICON_CHAT = 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z';
const ICON_SHOP =
  'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z M3 6h18 M16 10a4 4 0 0 1-8 0';
const ICON_OPS = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
const ICON_NOTICE =
  'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0';
const ICON_LIST = 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01';

function dashTile(
  id: DevTileId,
  ctx: {
    canManage: boolean;
    joinBadge: number;
    unread: number;
    onMembers: () => void;
    onJoin: () => void;
    onOps: () => void;
    onChat: () => void;
    onNotice: () => void;
    onShop: () => void;
    onList: () => void;
    onContrib: () => void;
    onInvest: () => void;
    onGrant: () => void;
  },
) {
  switch (id) {
    case 'members':
      return <DashTile label="길드원" icon={ICON_GUILD} tone="members" onClick={ctx.onMembers} />;
    case 'contrib':
      return <DashTile label="공헌도" icon={ICON_CONTRIB} tone="contrib" onClick={ctx.onContrib} />;
    case 'invest':
      return <DashTile label="투자" icon={ICON_INVEST} tone="invest" onClick={ctx.onInvest} />;
    case 'grant':
      return <DashTile label="지급" icon={ICON_GRANT} tone="grant" onClick={ctx.onGrant} />;
    case 'join':
      return ctx.canManage ? (
        <DashTile
          label="가입 신청"
          icon={ICON_JOIN}
          tone="join"
          badge={ctx.joinBadge}
          onClick={ctx.onJoin}
        />
      ) : null;
    case 'ops':
      return ctx.canManage ? (
        <DashTile label="운영" icon={ICON_OPS} tone="ops" onClick={ctx.onOps} />
      ) : null;
    case 'chat':
      return (
        <DashTile label="채팅" icon={ICON_CHAT} tone="chat" badge={ctx.unread} onClick={ctx.onChat} />
      );
    case 'notice':
      return <DashTile label="공지" icon={ICON_NOTICE} tone="notice" onClick={ctx.onNotice} />;
    case 'shop':
      return <DashTile label="상점" icon={ICON_SHOP} tone="shop" onClick={ctx.onShop} />;
    case 'list':
      return <DashTile label={DEV_TILE_LABEL.list} icon={ICON_LIST} tone="list" onClick={ctx.onList} />;
    default:
      return null;
  }
}

function DashTile({
  href,
  label,
  icon,
  tone,
  badge = 0,
  onClick,
}: {
  href?: string;
  label: string;
  icon: string;
  tone: 'members' | 'contrib' | 'invest' | 'grant' | 'join' | 'chat' | 'shop' | 'ops' | 'list' | 'notice';
  badge?: number;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {/* 다른 미읽음 배지와 같은 모양·색을 쓴다 — 여기만 강조색(로즈)이었다 */}
      <UnreadBadge count={badge} className="absolute top-1.5 right-1.5" />
      <span className="guild-dash-icon">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d={icon} />
        </svg>
      </span>
      <span>{label}</span>
    </>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className="guild-dash-tile" data-tone={tone}>
          {inner}
        </Link>
      ) : (
        <button type="button" className="guild-dash-tile" data-tone={tone} onClick={onClick}>
          {inner}
        </button>
      )}
    </li>
  );
}
