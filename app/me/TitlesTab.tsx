import { Card } from '@/components/cdm/Card';
import { TitleBadge, type TitleEffect } from '@/components/cdm/TitleBadge';
import { EmptyState } from '@/components/cdm/EmptyState';
import { getServerSupabase } from '@/lib/supabase/server';
import type { TitleColor } from '@/lib/supabase/database.types';
import {
  isTitleEffectKey,
  resolveBadge,
} from '@shared/titles/resolve-badge';
import { loadEquippedEffectKey } from '@shared/titles/resolve-displayed';
import TitleActions from './TitleActions';
import EffectActions from './EffectActions';
import TitlesSubTabs from './TitlesSubTabs';

interface OwnedTitleRow {
  id: number;
  title_id: string;
  granted_at: string;
}

interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
  effect: string | null;
  description: string | null;
  is_legend: boolean;
}

interface OwnedEffectRow {
  effect_id: string;
  granted_at: string;
  expires_at: string | null;
}

interface EffectDefRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

function badgeEffect(value: string | null | undefined): TitleEffect | null {
  return isTitleEffectKey(value) ? value : null;
}

function previewColor(key: string): TitleColor {
  if (key === 'issen') return 'silver';
  if (key === 'seongha') return 'midnight';
  if (key === 'sakura') return 'pink';
  if (key === 'frost') return 'cyan';
  if (key === 'lightning') return 'azure';
  if (key === 'wave') return 'ocean';
  if (key === 'dojang') return 'crimson';
  return 'gold';
}

export default async function TitlesTab({
  memberId,
  displayedTitleId,
  displayedEffectId,
  titleSub,
}: {
  memberId: string;
  displayedTitleId: string | null;
  displayedEffectId: string | null;
  titleSub?: string;
}) {
  const slot = titleSub === 'effects' ? 'effects' : 'titles';
  const sb = await getServerSupabase();

  const now = new Date().toISOString();
  const [titleCountRes, effectCountRes, equipped, legendRes] = await Promise.all([
    sb
      .from('member_titles')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .is('revoked_at', null),
    sb
      .from('member_title_effects')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .is('revoked_at', null)
      .or(`expires_at.is.null,expires_at.gt.${now}`),
    loadEquippedEffectKey(sb, memberId, displayedEffectId),
    displayedTitleId
      ? sb.from('titles').select('is_legend').eq('id', displayedTitleId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const titleCount = titleCountRes.count ?? 0;
  const effectCount = effectCountRes.count ?? 0;
  const legendBlocks = Boolean(
    (legendRes.data as { is_legend?: boolean } | null)?.is_legend,
  );

  return (
    <div className="flex flex-col gap-4">
      <TitlesSubTabs current={slot} titleCount={titleCount} effectCount={effectCount} />
      {slot === 'effects' ? (
        <EffectsPanel
          memberId={memberId}
          displayedEffectId={displayedEffectId}
          displayedTitleId={displayedTitleId}
          legendBlocks={legendBlocks}
        />
      ) : (
        <TitlesPanel
          memberId={memberId}
          displayedTitleId={displayedTitleId}
          equipped={equipped}
        />
      )}
    </div>
  );
}

async function TitlesPanel({
  memberId,
  displayedTitleId,
  equipped,
}: {
  memberId: string;
  displayedTitleId: string | null;
  equipped: { key: string } | null;
}) {
  const sb = await getServerSupabase();

  const ownedRes = await sb
    .from('member_titles')
    .select('id, title_id, granted_at')
    .eq('member_id', memberId)
    .is('revoked_at', null)
    .order('granted_at', { ascending: false });
  const owned = (ownedRes.data ?? []) as unknown as OwnedTitleRow[];

  if (owned.length === 0) {
    return <EmptyState title="아직 받은 칭호가 없습니다" />;
  }

  const titleIds = owned.map((o) => o.title_id);
  const titlesRes = await sb
    .from('titles')
    .select('id, name, color, effect, description, is_legend')
    .in('id', titleIds);
  const titlesMap = ((titlesRes.data ?? []) as unknown as TitleRow[]).reduce<
    Record<string, TitleRow>
  >((acc, t) => {
    acc[t.id] = t;
    return acc;
  }, {});

  const displayed = displayedTitleId ? titlesMap[displayedTitleId] : null;
  const displayedBadge = displayed
    ? resolveBadge(
        {
          name: displayed.name,
          color: displayed.color,
          is_legend: displayed.is_legend,
          effect: displayed.effect,
        },
        equipped,
      )
    : null;

  return (
    <div className="flex flex-col gap-4">
      {displayed && displayedBadge && (
        <Card variant="highlight" accent="highlight">
          <h2 className="text-xs font-semibold text-cdm-fg-muted">표시 칭호</h2>
          <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <TitleBadge
              name={displayedBadge.name}
              color={displayedBadge.color as TitleColor}
              effect={badgeEffect(displayedBadge.effect)}
              size="lg"
            />
            <TitleActions kind="unset" />
          </div>
          {displayed.description && (
            <p className="mt-2 text-sm text-cdm-fg-muted">{displayed.description}</p>
          )}
          {displayed.is_legend && equipped && (
            <p className="mt-2 text-sm text-cdm-accent-strong">
              레전드 칭호를 표시 중이라 이펙트가 적용되지 않습니다. 일반 칭호로 바꾸면 다시 보입니다.
            </p>
          )}
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg-muted">
          보유 칭호 ({owned.length})
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {owned.map((o) => {
            const t = titlesMap[o.title_id];
            if (!t) return null;
            const isDisplayed = t.id === displayedTitleId;
            return (
              <Card key={o.id} className="p-4!">
                <div className="flex items-center justify-between gap-2">
                  <TitleBadge
                    name={t.name}
                    color={t.color}
                    effect={badgeEffect(t.effect)}
                    size="md"
                  />
                  <div className="flex flex-col items-end gap-1">
                    {isDisplayed && (
                      <span className="text-xs font-semibold text-cdm-primary">표시 중</span>
                    )}
                    {t.is_legend && (
                      <span className="text-[11px] font-semibold text-cdm-accent-strong">
                        레전드 · 이펙트 장착 불가
                      </span>
                    )}
                  </div>
                </div>
                {t.description && (
                  <p className="mt-2 text-xs text-cdm-fg-muted">{t.description}</p>
                )}
                <p className="mt-2 text-[11px] text-cdm-fg-subtle">
                  획득 {new Date(o.granted_at).toLocaleDateString('ko-KR')}
                </p>
                {!isDisplayed && (
                  <div className="mt-3">
                    <TitleActions kind="set" titleId={t.id} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

async function EffectsPanel({
  memberId,
  displayedEffectId,
  displayedTitleId,
  legendBlocks,
}: {
  memberId: string;
  displayedEffectId: string | null;
  displayedTitleId: string | null;
  legendBlocks: boolean;
}) {
  const sb = await getServerSupabase();

  const now = new Date().toISOString();
  const ownedRes = await sb
    .from('member_title_effects')
    .select('effect_id, granted_at, expires_at')
    .eq('member_id', memberId)
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('granted_at', { ascending: false });
  const owned = (ownedRes.data ?? []) as unknown as OwnedEffectRow[];

  if (owned.length === 0) {
    return <EmptyState title="아직 보유한 이펙트가 없습니다" />;
  }

  const effectIds = owned.map((o) => o.effect_id);
  const defsRes = await sb
    .from('title_effect_defs')
    .select('id, key, name, description, is_active')
    .in('id', effectIds);
  const defsMap = ((defsRes.data ?? []) as unknown as EffectDefRow[]).reduce<
    Record<string, EffectDefRow>
  >((acc, d) => {
    acc[d.id] = d;
    return acc;
  }, {});

  const effects = owned.flatMap((o) => {
    const d = defsMap[o.effect_id];
    if (!d || !d.is_active) return [];
    return [{ ...d, granted_at: o.granted_at, expires_at: o.expires_at }];
  });

  return (
    <div className="flex flex-col gap-4">
      {legendBlocks && (
        <p className="text-sm text-cdm-fg-muted">
          레전드 칭호 표시 중 — 장착은 막히고, 해제는 가능합니다.
        </p>
      )}
      {!displayedTitleId && displayedEffectId && (
        <p className="text-sm text-cdm-fg-muted">이펙트는 칭호를 표시해야 보입니다.</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {effects.map((e) => {
          const equipped = e.id === displayedEffectId;
          return (
            <Card key={e.id} className="p-4!">
              <div className="flex items-start justify-between gap-2">
                <TitleBadge
                  name={e.name}
                  color={previewColor(e.key)}
                  effect={badgeEffect(e.key)}
                  size="md"
                />
                {equipped && (
                  <span className="text-xs font-semibold text-cdm-primary">장착 중</span>
                )}
              </div>
              {e.description && (
                <p className="mt-2 text-xs text-cdm-fg-muted">{e.description}</p>
              )}
              <p className="mt-2 text-[11px] text-cdm-fg-subtle">
                획득 {new Date(e.granted_at).toLocaleDateString('ko-KR')}
                {e.expires_at ? (
                  <span className="ml-2 text-cdm-fg-muted">
                    · {new Date(e.expires_at).toLocaleDateString('ko-KR')} 까지
                  </span>
                ) : (
                  <span className="ml-2 text-cdm-fg-muted">· 영구</span>
                )}
              </p>
              <div className="mt-3">
                {equipped ? (
                  <EffectActions kind="unset" />
                ) : (
                  <EffectActions kind="set" effectId={e.id} blocked={legendBlocks} />
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
