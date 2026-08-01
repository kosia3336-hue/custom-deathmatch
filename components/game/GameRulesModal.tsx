'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/cdm/Modal';
import { MarkdownView } from '@/lib/markdown';
import { getGameRule, type GameRuleMeta } from '@/lib/gameRules';

interface Props {
  /** 열려 있는 게임 ID (null이면 닫힘) */
  gameId: string | null;
  open: boolean;
  onClose: () => void;
}

interface RuleData {
  texts: Record<string, string>;
  meta: Record<string, GameRuleMeta>;
}

/** DB(game_rule_texts) 룰 텍스트/메타 캐시 — 세션 중 1회만 로드 */
let dataCache: RuleData | null = null;
let dataPromise: Promise<RuleData> | null = null;

async function loadRuleData(): Promise<RuleData> {
  if (dataCache) return dataCache;
  if (!dataPromise) {
    dataPromise = fetch('/api/game-rules')
      .then((res) => (res.ok ? res.json() : { texts: {}, meta: {} }))
      .then((json: { texts?: Record<string, string>; meta?: Record<string, GameRuleMeta> }) => {
        dataCache = { texts: json.texts ?? {}, meta: json.meta ?? {} };
        return dataCache;
      })
      .catch(() => {
        dataPromise = null;
        return { texts: {}, meta: {} };
      });
  }
  return dataPromise;
}

/** 게임 룰 확인 모달 — 룰 페이지·인게임 공용. DB 텍스트가 있으면 우선. */
export function GameRulesModal({ gameId, open, onClose }: Props) {
  const [data, setData] = useState<RuleData | null>(dataCache);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void loadRuleData().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const rule = gameId ? getGameRule(gameId) : undefined;
  const source = (gameId ? data?.texts[gameId] : undefined) ?? rule?.rules ?? '';
  const meta = gameId ? data?.meta[gameId] : undefined;
  const hasRules = Boolean(source.trim());
  const hasMeta = Boolean(meta && (meta.source || meta.originUrl || meta.originalAuthor || meta.poster));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rule ? `${rule.name} 룰` : '게임 룰'}
      size="lg"
      mobileBottomSheet
    >
      {hasRules ? (
        <div className="max-h-[65dvh] overflow-y-auto overscroll-contain pr-1">
          <MarkdownView source={source} />
          {hasMeta && (
            <div className="mt-5 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3 text-xs leading-relaxed text-cdm-fg-muted">
              {meta!.source && <p>출처: {meta!.source}</p>}
              {meta!.originalAuthor && <p>원작자: {meta!.originalAuthor}</p>}
              {meta!.poster && <p>게시자: {meta!.poster}</p>}
              {meta!.originUrl && (
                <p className="truncate">
                  원본 룰:{' '}
                  <a
                    href={meta!.originUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cdm-primary underline underline-offset-2"
                  >
                    {meta!.originUrl}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-cdm-fg-muted">
          아직 룰이 준비 중입니다.
        </p>
      )}
    </Modal>
  );
}
