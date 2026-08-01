import { Card } from '@/components/cdm/Card';
import { EmptyState } from '@/components/cdm/EmptyState';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSkinMeta } from '@/lib/skins/registry';
import SkinActions from './SkinActions';
import SkinPreview from './SkinPreview';

interface OwnedSkinRow {
  id: number;
  skin_id: string;
  equipped: boolean;
  granted_at: string;
  expires_at: string | null;
}

interface SkinMasterRow {
  id: string;
  game_id: string;
  name: string;
  description: string;
}

interface GameRow {
  id: string;
  name: string;
}

export default async function SkinsTab({ memberId }: { memberId: string }) {
  const sb = await getServerSupabase();

  const now = new Date().toISOString();
  const ownedRes = await sb
    .from('member_skins')
    .select('id, skin_id, equipped, granted_at, expires_at')
    .eq('member_id', memberId)
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('granted_at', { ascending: false });
  const owned = (ownedRes.data ?? []) as unknown as OwnedSkinRow[];

  if (owned.length === 0) {
    return (
      <EmptyState title="아직 보유한 스킨이 없습니다" />
    );
  }

  const skinIds = owned.map((o) => o.skin_id);
  const skinsRes = await sb
    .from('skins')
    .select('id, game_id, name, description')
    .in('id', skinIds);
  const skinsMap = ((skinsRes.data ?? []) as unknown as SkinMasterRow[]).reduce<Record<string, SkinMasterRow>>(
    (acc, s) => {
      acc[s.id] = s;
      return acc;
    },
    {},
  );

  const gameIds = [...new Set(Object.values(skinsMap).map((s) => s.game_id))];
  const gamesRes = await sb.from('games').select('id, name').in('id', gameIds);
  const gameNameMap = ((gamesRes.data ?? []) as unknown as GameRow[]).reduce<Record<string, string>>(
    (acc, g) => {
      acc[g.id] = g.name;
      return acc;
    },
    {},
  );

  // 게임별 그룹핑
  const groups = new Map<string, OwnedSkinRow[]>();
  for (const o of owned) {
    const skin = skinsMap[o.skin_id];
    if (!skin) continue;
    const list = groups.get(skin.game_id) ?? [];
    list.push(o);
    groups.set(skin.game_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      {[...groups.entries()].map(([gameId, rows]) => (
        <div key={gameId}>
          <h2 className="mb-2 text-sm font-semibold text-cdm-fg-muted">
            {gameNameMap[gameId] ?? gameId}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rows.map((o) => {
              const skin = skinsMap[o.skin_id];
              if (!skin) return null;
              const meta = getSkinMeta(skin.id);
              return (
                <Card
                  key={o.id}
                  className="p-4!"
                  variant={o.equipped ? 'highlight' : 'default'}
                  accent="highlight"
                >
                  {meta && (
                    <div className="mb-3">
                      <SkinPreview theme={meta.theme} />
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-cdm-fg">{meta?.name ?? skin.name}</h3>
                    {o.equipped && (
                      <span className="shrink-0 rounded-full bg-cdm-highlight-soft px-2 py-0.5 text-xs font-semibold text-cdm-highlight-strong">
                        착용 중
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-cdm-fg-subtle">
                    획득 {new Date(o.granted_at).toLocaleDateString('ko-KR')}
                    {o.expires_at ? (
                      <span className="ml-2 text-cdm-fg-muted">
                        · {new Date(o.expires_at).toLocaleDateString('ko-KR')} 까지
                      </span>
                    ) : (
                      <span className="ml-2 text-cdm-fg-muted">· 영구</span>
                    )}
                  </p>
                  <div className="mt-3">
                    <SkinActions skinId={skin.id} equipped={o.equipped} />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
