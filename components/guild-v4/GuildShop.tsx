'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { Modal } from '@/components/cdm/Modal';
import { Tabs } from '@/components/cdm/Tabs';
import { TextInput } from '@/components/cdm/TextInput';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  GUILD_BUFF_MAX_LEVEL,
  GUILD_MARK_COST_GP,
  GUILD_MAX_CAPACITY,
  GUILD_NAME_CHANGE_COST_GP,
  guildBuffCost,
  type MyGuildState,
} from '@/lib/guild/types';
import { GUILD_SCOUT_COST_GP, type GuildScoutTarget } from '@/lib/guild-v4/scoutTypes';
import type { GuildConfirm } from './GuildConfirmModal';
import { catalogLogoIdFromUrl, DEV_GUILD_LOGOS, devGuildLogoSrc } from './logoCatalog';
import { DEV_GUILD_NAME_MAX, DEV_GUILD_BUFF_PCT_PER_LEVEL, devExpansionCost, isValidDevGuildName } from './limits';
import RankLeaderRow from '@/components/ranking/RankLeaderRow';
import {
  RANK_CARD_SHOP_SKINS,
  RANK_CARD_SKIN_COST_GP,
  isRankCardActive,
  type RankCardShopSkinId,
} from '@shared/rank-card-skins';
import {
  GUILD_WAR_CHIP_PACK_GP,
  GUILD_WAR_CHIP_PACK_QTY_MAX,
  GUILD_WAR_CHIP_PACK_SIZE,
  clampGuildWarChipPackQty,
  guildWarChipPackChips,
  guildWarChipPackCost,
} from '@/lib/guild-v4/warChips';

type Act = (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;

const SHOP_TABS = [
  { id: 'enhance', label: '길드 강화' },
  { id: 'logo', label: '로고' },
  { id: 'rank-card', label: '랭킹카드' },
  { id: 'misc', label: '기타' },
  { id: 'war', label: '길드전' },
] as const;

const SHOP_DENY = '길드장·부길드장만 구매할 수 있습니다.';

function formatGp(n: number) {
  return `${n.toLocaleString('ko-KR')} GP`;
}

async function defaultLoadScout(): Promise<GuildScoutTarget[]> {
  const res = await fetch('/api/guild2/scout', { method: 'POST' });
  const json = (await res.json()) as { rows?: GuildScoutTarget[]; error?: string };
  if (!res.ok) throw new Error(json.error ?? '대상을 불러오지 못했습니다.');
  return json.rows ?? [];
}

function buyOrToast(canBuy: boolean, run: () => void) {
  if (!canBuy) {
    toast.error(SHOP_DENY);
    return;
  }
  run();
}

export function GuildShopSection({
  my,
  busy,
  act,
  askConfirm,
  onBuyNameChange,
  onScoutOpenChange,
  loadScoutTargets,
  rankCard,
  warChips,
}: {
  my: MyGuildState;
  busy: boolean;
  act: Act;
  askConfirm: (confirm: GuildConfirm) => void;
  onBuyNameChange: () => void;
  onScoutOpenChange?: (open: boolean) => void;
  loadScoutTargets?: () => Promise<GuildScoutTarget[]>;
  rankCard?: { skinId: RankCardShopSkinId; expiresAt: string } | null;
  warChips: number;
}) {
  const g = my.guild!;
  const [tab, setTab] = useState<string>('enhance');
  const [scoutOpen, setScoutOpen] = useState(false);
  const canBuy = my.role === 'owner' || my.role === 'vice_owner';
  const activeCard = isRankCardActive(rankCard) ? rankCard : null;
  const previewMark = g.markUrl
    ? { url: g.markUrl, name: g.name, guildId: g.id }
    : null;

  const buffMax = g.buffCdpLevel >= GUILD_BUFF_MAX_LEVEL;
  const buffCost = buffMax ? 0 : guildBuffCost(g.buffCdpLevel);
  const capMax = g.capacity >= GUILD_MAX_CAPACITY;
  const expandCost = capMax ? 0 : devExpansionCost(g.capacity);

  function openScout(open: boolean) {
    setScoutOpen(open);
    onScoutOpenChange?.(open);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-cdm-fg-muted">
        보유{' '}
        <strong className="tabular-nums text-cdm-primary">{formatGp(g.points)}</strong>
        <span className="mx-1.5 text-cdm-border-strong">·</span>
        길드전 칩{' '}
        <strong className="tabular-nums text-cdm-primary">{warChips.toLocaleString('ko-KR')}개</strong>
      </p>
      <Tabs tabs={[...SHOP_TABS]} value={tab} onChange={setTab} />
      {tab === 'enhance' && (
        <ul role="list" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <li>
            <GuildShopCard
              name="길드 등급"
              level={g.buffCdpLevel}
              description={
                <>
                  <span className="block">길드 등급을 올립니다.</span>
                  <span className="block">
                    랭크전 CDP 추가 적립 (레벨당 +{DEV_GUILD_BUFF_PCT_PER_LEVEL}%)
                  </span>
                </>
              }
              price={buffCost}
              maxed={buffMax}
              maxedLabel="최대 레벨"
              insufficient={!buffMax && g.points < buffCost}
              points={g.points}
              busy={busy}
              onBuy={() => {
                buyOrToast(canBuy, () => {
                  askConfirm({
                    title: '길드 등급',
                    message: `길드 포인트 ${buffCost.toLocaleString()} GP로 길드 등급을 Lv.${g.buffCdpLevel + 1}로 올리시겠습니까?`,
                    confirmLabel: '구매',
                    variant: 'primary',
                    run: () =>
                      act({ action: 'buy_buff' }, `길드 등급이 Lv.${g.buffCdpLevel + 1}이 됐습니다!`),
                  });
                });
              }}
            />
          </li>
          <li>
            <GuildShopCard
              name="정원 확장"
              description="정원을 1명 늘립니다."
              price={expandCost}
              maxed={capMax}
              maxedLabel="최대 정원"
              insufficient={!capMax && g.points < expandCost}
              points={g.points}
              busy={busy}
              onBuy={() => {
                buyOrToast(canBuy, () => {
                  askConfirm({
                    title: '정원 확장',
                    message: `길드 포인트 ${expandCost.toLocaleString()} GP로 정원을 1 늘리시겠습니까?`,
                    confirmLabel: '구매',
                    variant: 'primary',
                    run: () => act({ action: 'expand' }, '정원이 1 늘었습니다!'),
                  });
                });
              }}
            />
          </li>
          <li>
            <GuildShopCard
              name="길드명 변경"
              description="길드명을 변경합니다."
              price={GUILD_NAME_CHANGE_COST_GP}
              insufficient={g.points < GUILD_NAME_CHANGE_COST_GP}
              points={g.points}
              busy={busy}
              onBuy={() => buyOrToast(canBuy, onBuyNameChange)}
            />
          </li>
        </ul>
      )}
      {tab === 'logo' && (
        <ul role="list" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {DEV_GUILD_LOGOS.map((logo) => {
            const src = devGuildLogoSrc(logo.id);
            const using = catalogLogoIdFromUrl(g.markUrl) === logo.id;
            const insufficient = !using && g.points < GUILD_MARK_COST_GP;
            return (
              <li key={logo.id}>
                <button
                  type="button"
                  disabled={busy || using}
                  aria-label={using ? `${logo.name} 사용 중` : logo.name}
                  title={
                    using
                      ? '사용 중'
                      : insufficient
                        ? `${formatGp(GUILD_MARK_COST_GP - g.points)} 부족`
                        : logo.name
                  }
                  onClick={() => {
                    buyOrToast(canBuy, () => {
                      askConfirm({
                        title: '길드 로고',
                        message: `길드 포인트 ${GUILD_MARK_COST_GP.toLocaleString()} GP로 길드 로고를 적용하시겠습니까?`,
                        confirmLabel: '적용',
                        variant: 'primary',
                        run: () =>
                          act(
                            // 표시용 주소(.webp)가 아니라 로고 id 를 보낸다 — 서버는 id 로 저장 주소(.png)를 만든다
                            { action: 'set_mark', logoId: logo.id },
                            `길드 로고를 적용했습니다. (-${GUILD_MARK_COST_GP} GP)`,
                          ),
                      });
                    });
                  }}
                  className={cn(
                    'aspect-square w-full overflow-hidden rounded-cdm-md border',
                    using
                      ? 'cursor-default border-cdm-primary ring-2 ring-cdm-primary ring-offset-1'
                      : busy
                        ? 'cursor-not-allowed border-cdm-border opacity-50'
                        : 'cursor-pointer border-cdm-border hover:border-cdm-border-strong',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {tab === 'rank-card' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-cdm-fg-muted">
            길드원 전원의 랭킹 카드에 7일 동안 적용됩니다. 하나만 적용할 수 있습니다.
          </p>
          <ul role="list" className="flex flex-col gap-2">
            {RANK_CARD_SHOP_SKINS.map((skin) => {
              const active = activeCard?.skinId === skin.id;
              const insufficient = g.points < RANK_CARD_SKIN_COST_GP;
              return (
                <li key={skin.id}>
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={active ? `${skin.name} 적용 중` : skin.name}
                    title={
                      active
                        ? '적용 중'
                        : insufficient
                          ? `${formatGp(RANK_CARD_SKIN_COST_GP - g.points)} 부족`
                          : skin.name
                    }
                    onClick={() => {
                      buyOrToast(canBuy, () => {
                        askConfirm({
                          title: '랭킹카드',
                          message: `길드 포인트 ${RANK_CARD_SKIN_COST_GP.toLocaleString()} GP로 랭킹카드 스킨을 적용하시겠습니까?`,
                          confirmLabel: '적용',
                          variant: 'primary',
                          run: () =>
                            act(
                              { action: 'buy_rank_card', skinId: skin.id },
                              `랭킹카드 스킨을 적용했습니다. (-${RANK_CARD_SKIN_COST_GP} GP)`,
                            ),
                        });
                      });
                    }}
                    className={cn(
                      'w-full rounded-cdm-lg text-left',
                      active
                        ? 'ring-2 ring-cdm-primary ring-offset-1'
                        : busy
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer hover:ring-2 hover:ring-cdm-border-strong',
                    )}
                  >
                    <RankLeaderRow
                      rank={1}
                      nickname="미리보기"
                      title={{ name: '전설', color: 'gold', effect: 'legend' }}
                      tier="diamond"
                      rp={120}
                      placementDone
                      wins={48}
                      losses={12}
                      draws={4}
                      isChallenger
                      highlight={false}
                      guildMark={
                        previewMark
                          ? { url: previewMark.url, name: previewMark.name }
                          : null
                      }
                      skin={skin.id}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {tab === 'misc' && (
        <ul role="list" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <li>
            <GuildShopCard
              name="스카우트"
              description="우편으로 길드 초대를 보냅니다. 1명당 50 GP."
              price={GUILD_SCOUT_COST_GP}
              insufficient={g.points < GUILD_SCOUT_COST_GP}
              points={g.points}
              busy={busy}
              onBuy={() => {
                buyOrToast(canBuy, () => {
                  if (g.points < GUILD_SCOUT_COST_GP) {
                    toast.error('길드 포인트가 부족합니다.');
                    return;
                  }
                  openScout(true);
                });
              }}
            />
          </li>
        </ul>
      )}
      {tab === 'war' && (
        <ul role="list" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <li>
            <GuildWarChipCard
              points={g.points}
              busy={busy}
              canBuy={canBuy}
              askConfirm={askConfirm}
              act={act}
            />
          </li>
        </ul>
      )}

      <GuildScoutPicker
        open={scoutOpen}
        busy={busy}
        points={g.points}
        load={loadScoutTargets ?? defaultLoadScout}
        onClose={() => openScout(false)}
        onSend={(picked) => {
          const cost = picked.length * GUILD_SCOUT_COST_GP;
          askConfirm({
            title: '스카우트',
            message: `${picked.length}명에게 초대를 보내시겠습니까? (${formatGp(cost)})`,
            confirmLabel: '보내기',
            variant: 'primary',
            run: async () => {
              const ok = await act(
                { action: 'scout', targetMemberIds: picked.map((t) => t.memberId) },
                '초대를 보냈습니다.',
              );
              if (ok) openScout(false);
              return ok;
            },
          });
        }}
      />
    </div>
  );
}

export function GuildNameChangeModal({
  open,
  currentName,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  currentName: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open) setDraft('');
  }, [open]);

  const nameTrim = draft.trim();
  const nameValid = isValidDevGuildName(nameTrim);
  const nameUnchanged = nameTrim === currentName;
  const canSubmit = nameValid && !nameUnchanged && !busy;

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="길드명 변경"
      size="sm"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!canSubmit}
            onClick={() => {
              void onSubmit(nameTrim).then((ok) => {
                if (ok) onClose();
              });
            }}
          >
            변경
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-cdm-fg">
        길드 포인트 {GUILD_NAME_CHANGE_COST_GP.toLocaleString()} GP가 소모됩니다.
      </p>
      <TextInput
        label="새 길드명"
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, DEV_GUILD_NAME_MAX))}
        maxLength={DEV_GUILD_NAME_MAX}
        placeholder={currentName}
        autoFocus={open}
        hint={`${draft.length}/${DEV_GUILD_NAME_MAX} · 영어·한글만, 2~${DEV_GUILD_NAME_MAX}자`}
        error={
          nameTrim.length > 0 && !nameValid
            ? '영어·한글만, 2~10자 (공백·숫자·특수문자 불가)'
            : nameUnchanged
              ? '현재와 같은 이름입니다.'
              : null
        }
      />
    </Modal>
  );
}

function GuildScoutPicker({
  open,
  busy,
  points,
  load,
  onClose,
  onSend,
}: {
  open: boolean;
  busy: boolean;
  points: number;
  load: () => Promise<GuildScoutTarget[]>;
  onClose: () => void;
  onSend: (picked: GuildScoutTarget[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<GuildScoutTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setQuery('');
      setRows([]);
      setPicked(new Set());
      return;
    }
    let cancelled = false;
    setLoading(true);
    void load()
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          toast.error((err as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.nickname.toLowerCase().includes(q)) : rows;
  const selected = rows.filter((r) => picked.has(r.memberId) && !r.alreadyInvited);
  const cost = selected.length * GUILD_SCOUT_COST_GP;
  const canSend = selected.length > 0 && points >= cost && !busy;

  function toggle(id: string, invited: boolean) {
    if (invited || busy) return;
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="스카우트"
      size="md"
      closeOnBackdrop={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            닫기
          </Button>
          <Button
            disabled={!canSend}
            onClick={() => onSend(selected)}
          >
            {selected.length === 0
              ? '보내기'
              : `보내기 · ${selected.length}명 · ${formatGp(cost)}`}
          </Button>
        </>
      }
    >
      <TextInput
        label="필터"
        value={query}
        onChange={(e) => setQuery(e.target.value.slice(0, 20))}
        placeholder="닉네임"
      />
      <ul className="mt-3 max-h-72 divide-y divide-cdm-border overflow-y-auto rounded-cdm-md border border-cdm-border">
        {loading ? (
          <li className="px-3 py-4 text-center text-xs text-cdm-fg-muted">불러오는 중…</li>
        ) : shown.length === 0 ? (
          <li className="px-3 py-4 text-center text-xs text-cdm-fg-muted">대상이 없습니다.</li>
        ) : (
          shown.map((row) => {
            const on = picked.has(row.memberId);
            return (
              <li key={row.memberId}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-3 py-2.5',
                    row.alreadyInvited && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-cdm-primary"
                    checked={on}
                    disabled={busy || row.alreadyInvited}
                    onChange={() => toggle(row.memberId, row.alreadyInvited)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-cdm-fg">{row.nickname}</span>
                    <span className="block text-xs text-cdm-fg-muted">
                      {row.alreadyInvited
                        ? '초대됨'
                        : row.hasGuild
                          ? `길드 있음${row.guildName ? ` · ${row.guildName}` : ''}`
                          : '미가입'}
                    </span>
                  </span>
                </label>
              </li>
            );
          })
        )}
      </ul>
    </Modal>
  );
}

function GuildWarChipCard({
  points,
  busy,
  canBuy,
  askConfirm,
  act,
}: {
  points: number;
  busy: boolean;
  canBuy: boolean;
  askConfirm: (confirm: GuildConfirm) => void;
  act: Act;
}) {
  const [qty, setQty] = useState(1);
  const chips = guildWarChipPackChips(qty);
  const cost = guildWarChipPackCost(qty);
  const insufficient = points < cost;

  function setQtyClamped(n: number) {
    setQty(clampGuildWarChipPackQty(n));
  }

  let ctaLabel = '구매';
  let ctaVariant: 'primary' | 'secondary' = 'primary';
  if (insufficient) {
    ctaLabel = `${formatGp(cost - points)} 부족`;
    ctaVariant = 'secondary';
  }

  return (
    <article className="h-full">
      <Card className="flex h-full flex-col gap-2 p-3!">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-cdm-fg">
            칩 {GUILD_WAR_CHIP_PACK_SIZE}개
          </h3>
          <span className="shrink-0 text-sm font-bold tabular-nums whitespace-nowrap text-cdm-fg">
            {formatGp(GUILD_WAR_CHIP_PACK_GP)}
          </span>
        </div>
        <p className="text-xs text-cdm-fg-muted">
          이벤트 종료 시 남은 칩은 자동으로 수수료 20%를 떼고 GP로 환전됩니다.
        </p>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted" htmlFor="guild-war-chip-qty">
            수량
          </label>
          <div className="mt-1 flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || qty <= 1}
              onClick={() => setQtyClamped(qty - 1)}
              aria-label="수량 줄이기"
            >
              −
            </Button>
            <input
              id="guild-war-chip-qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={GUILD_WAR_CHIP_PACK_QTY_MAX}
              value={qty}
              onChange={(e) => setQtyClamped(Number(e.target.value))}
              className="w-20 rounded-cdm-md border border-cdm-border bg-cdm-bg px-2 py-1.5 text-center text-sm tabular-nums"
              disabled={busy}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || qty >= GUILD_WAR_CHIP_PACK_QTY_MAX}
              onClick={() => setQtyClamped(qty + 1)}
              aria-label="수량 늘리기"
            >
              +
            </Button>
          </div>
          <p className="mt-1.5 text-xs tabular-nums text-cdm-fg-muted">
            칩 {chips.toLocaleString('ko-KR')}개 · {formatGp(cost)}
          </p>
        </div>
        <Button
          size="sm"
          fullWidth
          variant={ctaVariant}
          disabled={busy}
          onClick={() => {
            buyOrToast(canBuy, () => {
              askConfirm({
                title: `칩 ${chips.toLocaleString('ko-KR')}개`,
                message: `길드 포인트 ${cost.toLocaleString('ko-KR')} GP로 칩 ${chips.toLocaleString('ko-KR')}개를 구매하시겠습니까?`,
                confirmLabel: '구매',
                variant: 'primary',
                run: () =>
                  act(
                    { action: 'buy_war_chip_pack', quantity: qty },
                    `칩 ${chips.toLocaleString('ko-KR')}개를 구매했습니다. (-${cost.toLocaleString('ko-KR')} GP)`,
                  ),
              });
            });
          }}
          className="mt-auto cursor-pointer"
        >
          {ctaLabel}
        </Button>
      </Card>
    </article>
  );
}

function GuildShopCard({
  name,
  level,
  description,
  price,
  maxed = false,
  maxedLabel = '보유 중',
  insufficient,
  points,
  busy,
  buyLabel = '구매',
  onBuy,
}: {
  name: string;
  level?: number;
  description?: ReactNode;
  price: number;
  maxed?: boolean;
  maxedLabel?: string;
  insufficient: boolean;
  points: number;
  busy: boolean;
  buyLabel?: string;
  onBuy: () => void;
}) {
  let ctaLabel = buyLabel;
  let ctaVariant: 'primary' | 'secondary' = 'primary';
  let ctaDisabled = busy;

  if (maxed) {
    ctaLabel = maxedLabel;
    ctaVariant = 'secondary';
    ctaDisabled = true;
  } else if (insufficient) {
    ctaLabel = `${formatGp(price - points)} 부족`;
    ctaVariant = 'secondary';
  }

  return (
    <article className="h-full">
      <Card className="flex h-full flex-col gap-2 p-3!">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-cdm-fg">
            {name}
            {level !== undefined && (
              <span className="ml-1.5 font-bold tabular-nums text-cdm-primary">Lv.{level}</span>
            )}
          </h3>
          {!maxed && (
            <span className="shrink-0 text-sm font-bold tabular-nums whitespace-nowrap text-cdm-fg">
              {formatGp(price)}
            </span>
          )}
        </div>
        {description != null && description !== '' && (
          <div className="flex min-h-[2.4em] flex-col gap-0.5 text-xs text-cdm-fg-muted">
            {description}
          </div>
        )}
        <Button
          size="sm"
          fullWidth
          variant={ctaVariant}
          disabled={ctaDisabled}
          onClick={onBuy}
          className="mt-auto cursor-pointer"
        >
          {ctaLabel}
        </Button>
      </Card>
    </article>
  );
}
