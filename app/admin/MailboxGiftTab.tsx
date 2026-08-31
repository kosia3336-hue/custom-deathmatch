'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { cn } from '@/lib/utils';

/** rank_stats.tier 에 실제로 들어가는 값들. */
const TIERS = [
  { id: 'challenger', label: '챌린저' },
  { id: 'diamond', label: '다이아' },
  { id: 'gold', label: '골드' },
  { id: 'silver', label: '실버' },
  { id: 'bronze', label: '브론즈' },
  { id: 'unranked', label: '언랭' },
] as const;

interface SendResult {
  targeted: number;
  sent: number;
  skipped: number;
}

/**
 * 우편 발송.
 *
 * 보상은 편지에 매달아 보내고 받는 사람이 눌러서 받는다. 여기서 잔액을 직접
 * 건드리지 않는다 — 지급은 수령 시점에 RPC 안에서 한 번만 일어난다.
 */
export default function MailboxGiftTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('운영팀');
  const [cdp, setCdp] = useState(0);
  const [giftKey, setGiftKey] = useState('');
  const [seasonId, setSeasonId] = useState(3);
  const [tiers, setTiers] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [found, setFound] = useState<{ id: string; nickname: string }[]>([]);
  const [picked, setPicked] = useState<{ id: string; nickname: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [mode, setMode] = useState<'tier' | 'members'>('tier');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  function toggleTier(id: string) {
    setTiers((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function runSearch() {
    const q = search.trim();
    if (!q) return;
    setSearching(true);
    try {
      const r = await fetch(`/api/admin/member-search?q=${encodeURIComponent(q)}`);
      const data = (await r.json()) as {
        items?: { id: string; nickname: string }[];
        error?: string;
      };
      if (!r.ok) throw new Error(data.error ?? '검색에 실패했습니다.');
      setFound(data.items ?? []);
      if ((data.items ?? []).length === 0) toast.info('일치하는 회원이 없습니다.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function pick(m: { id: string; nickname: string }) {
    setPicked((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const target =
        mode === 'tier'
          ? { kind: 'tier' as const, seasonId, tiers }
          : { kind: 'members' as const, memberIds: picked.map((m) => m.id) };
      const r = await fetch('/api/admin/mailbox-gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, sender, cdp, giftKey, target }),
      });
      const data = (await r.json()) as SendResult & { error?: string };
      if (!r.ok) throw new Error(data.error ?? '발송에 실패했습니다.');
      setResult({ targeted: data.targeted, sent: data.sent, skipped: data.skipped });
      toast.success(`${data.sent}통 발송 (건너뜀 ${data.skipped})`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  const canSend =
    !sending &&
    title.trim().length > 0 &&
    /^[a-z0-9-]{3,60}$/.test(giftKey) &&
    (mode === 'tier' ? tiers.length > 0 : picked.length > 0);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h2 className="text-cdm-fg text-lg font-bold">우편 발송</h2>
        <p className="text-cdm-fg-muted mt-1 text-sm">
          편지에 CDP 를 매달아 보냅니다. 받는 사람이 우편함에서 눌러 받을 때 지급됩니다.
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-cdm-fg text-sm font-semibold">제목</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="시즌 3 랭크 보상"
          className="border-cdm-border rounded-cdm-md h-10 border px-3 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-cdm-fg text-sm font-semibold">본문</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="시즌 3 참여 감사합니다. 최종 티어 보상을 보내드립니다."
          className="border-cdm-border rounded-cdm-md border px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-cdm-fg text-sm font-semibold">보낸이</span>
          <input
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            className="border-cdm-border rounded-cdm-md h-10 border px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-cdm-fg text-sm font-semibold">CDP</span>
          <input
            type="number"
            min={0}
            max={100000}
            value={cdp}
            onChange={(e) => setCdp(Number(e.target.value))}
            className="border-cdm-border rounded-cdm-md h-10 border px-3 text-sm tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-cdm-fg text-sm font-semibold">우편 키</span>
          <input
            value={giftKey}
            onChange={(e) => setGiftKey(e.target.value)}
            placeholder="season3-diamond"
            className="border-cdm-border rounded-cdm-md h-10 border px-3 text-sm"
          />
        </label>
      </div>
      <p className="text-cdm-fg-muted -mt-3 text-xs">
        우편 키는 중복 발송을 막는 열쇠입니다. 같은 키로 다시 보내면 이미 받은 사람은 건너뜁니다.
        티어별로 금액이 다르면 <b>키도 티어마다 다르게</b> 주세요.
      </p>

      <div className="border-cdm-border rounded-cdm-md border p-4">
        <div className="flex gap-2">
          {(['tier', 'members'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-cdm-md border px-3 py-1.5 text-xs font-bold',
                mode === m
                  ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
                  : 'border-cdm-border text-cdm-fg',
              )}
            >
              {m === 'tier' ? '티어로 보내기' : '닉네임으로 보내기'}
            </button>
          ))}
        </div>

        {mode === 'tier' ? (
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex items-center gap-2">
              <span className="text-cdm-fg text-sm font-semibold">시즌</span>
              <input
                type="number"
                value={seasonId}
                onChange={(e) => setSeasonId(Number(e.target.value))}
                className="border-cdm-border rounded-cdm-md h-9 w-24 border px-3 text-sm tabular-nums"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTier(t.id)}
                  className={cn(
                    'rounded-cdm-md border px-3 py-1.5 text-xs font-bold',
                    tiers.includes(t.id)
                      ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
                      : 'border-cdm-border text-cdm-fg',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder="닉네임으로 검색"
                className="border-cdm-border rounded-cdm-md h-10 flex-1 border px-3 text-sm"
              />
              <Button size="sm" onClick={runSearch} disabled={searching || !search.trim()}>
                {searching ? '찾는 중...' : '검색'}
              </Button>
            </div>

            {found.length > 0 && (
              <div className="border-cdm-border rounded-cdm-md max-h-48 overflow-y-auto border">
                {found.map((m) => {
                  const already = picked.some((x) => x.id === m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pick(m)}
                      disabled={already}
                      className={cn(
                        'border-cdm-border flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0',
                        already ? 'text-cdm-fg-subtle' : 'hover:bg-cdm-bg-elev-1 text-cdm-fg',
                      )}
                    >
                      <span>{m.nickname}</span>
                      <span className="text-xs">{already ? '추가됨' : '추가'}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <p className="text-cdm-fg-muted text-xs font-semibold">받는 사람 {picked.length}명</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {picked.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPicked((prev) => prev.filter((x) => x.id !== m.id))}
                    className="bg-cdm-bg-elev-1 text-cdm-fg rounded-full px-3 py-1 text-xs font-semibold"
                    aria-label={`${m.nickname} 빼기`}
                  >
                    {m.nickname} ×
                  </button>
                ))}
                {picked.length === 0 && (
                  <span className="text-cdm-fg-subtle text-xs">검색해서 추가하세요.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button disabled={!canSend} onClick={send}>
          {sending ? '보내는 중...' : '발송'}
        </Button>
        {result && (
          <p className="text-cdm-fg-muted text-sm">
            대상 {result.targeted}명 · 발송 <b className="text-cdm-fg">{result.sent}</b>통 · 건너뜀{' '}
            {result.skipped}
          </p>
        )}
      </div>
    </div>
  );
}
