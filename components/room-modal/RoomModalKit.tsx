'use client';

/**
 * '새 방 만들기'· '방 설정 변경' 두 모달이 함께 쓰는 조각들.
 * 둘 다 같은 구조(어두운 헤더 + 흰 본문 + 게임 카드 그리드 + 접이식 상세 설정)라
 * 따로 관리하면 한쪽만 고치고 잊어버리기 쉽다 — 여기 하나만 고치면 둘 다 바뀐다.
 */

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GAME_CATEGORIES, categoryHue, getGameRule, type GameCategory } from '@/lib/gameRules';
import type { Game } from '@/shared/types';

const subscribeToClientMount = () => () => {};

/* ══════════════════════════ 아이콘 ══════════════════════════ */
/* 컴포넌트 본문 안에서 정의하면 렌더마다 타입이 바뀌어 서브트리가 다시 마운트된다 */

export function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
/** 상세 설정 여닫이 표시 — 펴면 아래를 가리킨다 */
export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-4 w-4 text-cdm-fg-subtle transition-transform', open && 'rotate-90')}
      fill="none" viewBox="0 0 24 24" stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg className="h-4 w-4 text-cdm-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

/** 선택 표시 — 테두리만으로는 훑을 때 눈에 안 들어와 체크를 함께 둔다 */
export function CheckMark() {
  return (
    <span
      aria-hidden
      className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cdm-primary text-white"
    >
      {/* 규격(1.8) 예외 — 10px 라 그대로 쓰면 실제 선이 0.75px 로 사라진다.
          3.5 는 24 viewBox 기준값이라 10px 로 줄면 약 1.46px, sm(16px) 아이콘과 비슷해진다. */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

/* ══════════════════════════ 모달 껍데기 ══════════════════════════ */

/**
 * 백드롭 + 포털 + 헤더 + 스크롤 본문 + 푸터. 두 모달의 뼈대가 100% 같아서
 * 여기 하나로 묶는다 — 마운트 가드(SSR 포털 방지)도 안에서 처리한다.
 */
export function RoomModalShell({
  open, title, onClose, children, footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const mounted = useSyncExternalStore(
    subscribeToClientMount,
    () => true,
    () => false,
  );
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center sm:items-center sm:p-4">
          {/* 백드롭 */}
          <motion.div
            className="fixed inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* 모달 패널 */}
          <motion.div
            className="relative z-10 flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-xl"
            style={{ maxHeight: 'min(92dvh, 92vh)' }}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* ── 헤더 (고정) ── */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-cdm-ink-border bg-cdm-ink px-5 py-4">
              <h2 className="text-lg font-bold text-cdm-ink-fg">{title}</h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-cdm-ink-fg-muted hover:bg-white/10 hover:text-white"
                aria-label="닫기"
              >
                <CloseIcon />
              </button>
            </div>

            {/* ── 본문 (스크롤) ── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="space-y-5 px-5 py-5">{children}</div>
            </div>

            {/* ── 푸터 (고정) ── */}
            <div className="flex-shrink-0 border-t border-cdm-border px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ══════════════════════════ 상세 설정 여닫이 ══════════════════════════ */

/**
 * `blocked` 가 있으면 열지 않고 `onBlockedClick` 만 호출한다 — 새 방 만들기에서
 * "게임을 먼저 선택해 주세요" 안내를 띄우는 데 쓴다. 방 설정에서는 게임이 이미
 * 정해져 있으므로 그냥 생략하면 된다.
 */
export function SettingsAccordion({
  open, onToggle, blocked = false, onBlockedClick, children,
}: {
  open: boolean;
  onToggle: () => void;
  blocked?: boolean;
  onBlockedClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-cdm-border">
      <button
        type="button"
        onClick={() => (blocked ? onBlockedClick?.() : onToggle())}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors',
          blocked ? 'text-cdm-fg-subtle' : 'text-cdm-fg-muted hover:bg-cdm-bg-elev-1',
        )}
      >
        <span className="flex items-center gap-2">
          <GearIcon />
          상세 설정
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-cdm-border px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}

/** 상세 설정 안에서 항목 하나 = 라벨 + 내용. 부제(hint)는 옅게. */
export function SettingField({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-cdm-fg">
        {label}
        {hint && <span className="font-normal text-cdm-fg-subtle"> {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** 표시할 설정이 없을 때 안내 문구 */
export function EmptyDetailNotice({ text = '이 모드에서는 추가 설정이 없습니다.' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-cdm-border bg-cdm-bg-elev-1 px-4 py-10 text-center">
      <p className="text-sm text-cdm-fg-muted">{text}</p>
    </div>
  );
}

/* ══════════════════════════ 선택형 버튼 ══════════════════════════ */

/** 방 유형·플레이 모드·최대 인원 등 "여러 개 중 하나 고르기" 버튼의 공통 모양 */
export function OptionButton({
  active, onClick, children, size = 'md', disabled, className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: 'md' | 'sm' | 'square';
  disabled?: boolean;
  className?: string;
}) {
  const sizeClass = {
    md: 'rounded-lg px-4 py-2 text-sm',
    sm: 'rounded-md px-3 py-1.5 text-xs',
    square: 'h-10 w-10 rounded-lg text-sm',
  }[size];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'border font-medium transition-colors disabled:opacity-30',
        sizeClass,
        active
          ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary-strong'
          : 'border-cdm-border hover:border-cdm-border-strong',
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════ 게임 카드 ══════════════════════════ */

const CARD_BASE =
  'relative h-20 overflow-hidden rounded-lg border text-left transition-colors';
const CARD_STATE = (active: boolean) =>
  active
    ? 'border-cdm-primary bg-cdm-primary-soft ring-2 ring-cdm-primary'
    : 'border-cdm-border bg-cdm-bg hover:border-cdm-border-strong hover:bg-cdm-bg-elev-1';

/**
 * 대표 이미지 — 꾸밈용이라 오른쪽 영역에만 흐리게 깐다.
 * 글자 영역과 폭을 나눠 두어 서로 침범하지 않고, 왼쪽으로 갈수록 사라진다.
 * 배경 이미지라 파일이 없는 게임은 깨진 아이콘 없이 그냥 비어 보인다.
 */
export function CardArt({ src, className }: { src: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute inset-y-0 right-0 bg-cover bg-center opacity-35', className)}
      style={{
        backgroundImage: `url(${src})`,
        maskImage: 'linear-gradient(to right, transparent, #000 70%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 70%)',
      }}
    />
  );
}

/** 랜덤·밴픽처럼 게임이 아니라 '방식'을 고르는 카드 — 한 줄을 통째로 쓴다 */
export function ModeCard({
  label, desc, art, active, onClick, className,
}: { label: string; desc: string; art: string; active: boolean; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn(CARD_BASE, CARD_STATE(active), 'sm:col-span-3', className)}>
      <CardArt src={art} className="w-[42%]" />
      {active && <CheckMark />}
      <span className="relative flex h-full w-[58%] flex-col justify-center pl-3">
        <span className={cn('text-sm font-semibold', active ? 'text-cdm-primary-strong' : 'text-cdm-fg')}>
          {label}
        </span>
        <span className="mt-0.5 text-xs text-cdm-fg-muted">{desc}</span>
      </span>
    </button>
  );
}

/** 게임 카드 — 갈래는 목록 머리글/필터 칩이 이미 말해 주므로 이름만 둔다 */
/** 등록 한 달 안이면 새 게임으로 본다. */
const NEW_GAME_DAYS = 30;

export function isNewGame(createdAt: string | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  return now - t < NEW_GAME_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * 카드 왼쪽 위 모서리에 비스듬히 덧대는 띠.
 *
 * 카드가 overflow-hidden 이라 45도로 눕힌 띠의 양 끝이 잘려 나가고, 모서리에
 * 포장지를 덧댄 모양만 남는다. 폭을 좁게 잡아 게임 이름을 침범하지 않는다 —
 * 이름은 카드 높이 가운데에 있어서, 띠가 모서리에만 머무르면 겹치지 않는다.
 *
 * NEW 와 RANK 가 모양도 색도 같고 글자만 다르다. 둘 다 '이 카드를 눈여겨보라'
 * 는 같은 종류의 신호라 갈라 놓을 이유가 없었다.
 */
function CornerRibbon({ label, title }: { label: string; title: string }) {
  return (
    <span
      title={title}
      className={cn(
        'pointer-events-none absolute -left-6 top-1.5 w-[72px] -rotate-45 py-[2px] text-center',
        'bg-cdm-primary text-[9px] leading-none font-bold tracking-wider text-white',
      )}
    >
      {label}
    </span>
  );
}

export function GameCard({
  game, active, onClick, className,
}: {
  game: Game;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  /*
    랭크와 신규가 겹치면 랭크를 보여 준다. 신규는 한 달이면 사라지는 표시고
    랭크는 그 게임의 성격이라, 하나만 남긴다면 랭크가 남아야 한다.
  */
  const ribbon = game.rankingActive
    ? { label: 'RANK', title: '랭크 종목' }
    : isNewGame(game.createdAt)
      ? { label: 'NEW', title: '새로 추가된 게임' }
      : null;

  return (
    <button type="button" onClick={onClick} className={cn(CARD_BASE, CARD_STATE(active), 'sm:col-span-2', className)}>
      <CardArt src={`/games/${game.id}.webp`} className="w-[42%]" />
      {ribbon && <CornerRibbon label={ribbon.label} title={ribbon.title} />}
      {active && <CheckMark />}
      <span className="relative flex h-full w-[58%] flex-col justify-center pl-3">
        <span className={cn('text-sm leading-tight font-semibold break-keep', active ? 'text-cdm-primary-strong' : 'text-cdm-fg')}>
          {game.name}
        </span>
      </span>
    </button>
  );
}

/** 갈래 필터 버튼 — 로비 방 검색과 같은 갈래·색을 쓴다 */
export function CatChip({
  label, hue, active, onClick,
}: { label: string; hue?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
        active
          ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary-strong'
          : 'border-cdm-border bg-cdm-bg text-cdm-fg-muted hover:border-cdm-border-strong',
      )}
    >
      {hue !== undefined && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: `hsl(${hue} 62% 55%)` }}
        />
      )}
      {label}
    </button>
  );
}

/* ══════════════════════════ 게임 선택 블록 ══════════════════════════ */

/** 랜덤·밴픽처럼 게임 목록에 없는 '방식' 선택지 — 검색·갈래 필터에서는 갈래 없는 항목과 같이 취급한다 */
export interface PickerMode {
  id: string;
  label: string;
  desc: string;
  art: string;
}

/**
 * "게임 선택" 라벨부터 카드 그리드까지 통째로. 검색 + 갈래 필터 버튼(항상 노출) +
 * 카드 그리드, 고르면 접혀서 고른 카드 하나만 남고 '변경'으로 다시 편다.
 * 새 방 만들기(랜덤·밴픽 포함)와 방 설정(순수 게임 목록)이 이 하나를 같이 쓴다.
 */
export function GameListPicker({
  games, modes = [], activeGameId = null, activeModeId = null,
  onSelectGame, onSelectMode,
  listOpen, onOpenList,
  search, onSearchChange,
  catFilter, onCatFilterChange,
}: {
  games: Game[];
  modes?: PickerMode[];
  activeGameId?: string | null;
  activeModeId?: string | null;
  onSelectGame: (g: Game) => void;
  onSelectMode: (modeId: string) => void;
  listOpen: boolean;
  onOpenList: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  catFilter: GameCategory | null;
  onCatFilterChange: (c: GameCategory | null) => void;
}) {
  const query = search.trim();

  /*
    갈래가 없는 항목(랜덤·밴픽)은 필터를 걸면 빠진다. 갈래를 고르는 건 '그
    성격의 게임을 보겠다' 는 뜻이라, 성격이 없는 항목까지 끼워 넣을 자리가 없다.
    필터를 풀면 맨 위에 그대로 보인다.
  */
  const matchesCat = (category?: string) => !catFilter || category === catFilter;
  const matchesQuery = (name: string) => !query || name.includes(query);

  const filteredGames = games.filter(
    (g) => matchesCat(getGameRule(g.id)?.category) && matchesQuery(g.name),
  );
  const visibleModes = modes.filter((m) => matchesCat(undefined) && matchesQuery(m.label));
  const hasResults = filteredGames.length > 0 || visibleModes.length > 0;

  const activeMode = modes.find((m) => m.id === activeModeId);
  const activeGame = games.find((g) => g.id === activeGameId);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <label className="shrink-0 text-sm font-medium text-cdm-fg">게임 선택</label>
        {listOpen ? (
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="검색"
              className="h-7 w-full rounded-md border border-cdm-border pl-2 pr-6 text-xs focus:border-cdm-primary focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-cdm-fg-subtle hover:text-cdm-fg-muted"
                aria-label="검색 초기화"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        ) : (
          /* 고르고 나면 목록을 접어 둔다 — 아래 설정이 바로 보이도록 */
          <button
            type="button"
            onClick={onOpenList}
            className="ml-auto text-xs font-semibold text-cdm-primary hover:underline"
          >
            변경
          </button>
        )}
      </div>

      {listOpen ? (
        <>
          {/* 갈래 필터 — 로비 방 검색과 같은 갈래 기준 */}
          <div className="mb-2 flex flex-wrap gap-1.5">
            <CatChip label="전체" active={catFilter === null} onClick={() => onCatFilterChange(null)} />
            {GAME_CATEGORIES.map((c) => (
              <CatChip
                key={c}
                label={c}
                hue={categoryHue(c)}
                active={catFilter === c}
                onClick={() => onCatFilterChange(catFilter === c ? null : c)}
              />
            ))}
          </div>

          {/* 목록 — 모달 본문 하나만 스크롤하도록 자체 스크롤을 두지 않는다 */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-cdm-border bg-cdm-page p-2 sm:grid-cols-6">
            {visibleModes.map((m) => (
              <ModeCard
                key={m.id}
                label={m.label}
                desc={m.desc}
                art={m.art}
                active={activeModeId === m.id}
                onClick={() => onSelectMode(m.id)}
              />
            ))}

            {filteredGames.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                active={activeGameId === g.id}
                onClick={() => onSelectGame(g)}
              />
            ))}

            {!hasResults && (
              <p className="col-span-2 py-6 text-center text-xs text-cdm-fg-muted sm:col-span-6">
                조건에 맞는 게임이 없습니다.
              </p>
            )}
          </div>
        </>
      ) : (
        /* 접힌 상태 — 고른 것만 보여 준다 */
        <div className="rounded-lg border border-cdm-border bg-cdm-page p-2">
          {activeMode ? (
            <ModeCard
              label={activeMode.label}
              desc={activeMode.desc}
              art={activeMode.art}
              active
              onClick={onOpenList}
              className="w-full sm:col-span-full"
            />
          ) : activeGame ? (
            <GameCard
              game={activeGame}
              active
              onClick={onOpenList}
              className="w-full sm:col-span-full"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
