'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  SBNW_MAX_SCORE,
  SBNW_TILES,
  sbnwAdvisorAsk,
  sbnwAdvisorFinished,
  sbnwAdvisorSnapshot,
  sbnwAdvisorWinnerFromResult,
  sbnwTilesToValue,
  sbnwValidateTiles,
  type SBNWTile,
  type SbnwAdvisorPending,
  type SbnwAdvisorRound,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-sbnw-advisor-v1';

type Stored = {
  iAmFirst: boolean | null;
  history: SbnwAdvisorRound[];
  pending: SbnwAdvisorPending;
};

function loadStored(): Stored {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { iAmFirst: null, history: [], pending: {} };
    const parsed = JSON.parse(raw) as Stored;
    if (typeof parsed.iAmFirst !== 'boolean' && parsed.iAmFirst !== null) {
      return { iAmFirst: null, history: [], pending: {} };
    }
    if (!Array.isArray(parsed.history)) return { iAmFirst: null, history: [], pending: {} };
    return {
      iAmFirst: parsed.iAmFirst,
      history: parsed.history,
      pending: parsed.pending ?? {},
    };
  } catch {
    return { iAmFirst: null, history: [], pending: {} };
  }
}

async function ensureAdvisorSocket(): Promise<void> {
  const s = await connectSocket();
  if (!s.connected) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('소켓 연결 시간 초과')), 8000);
      s.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
    });
  }
  if (!useNicknameStore.getState().nickname) {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        s.off('session:restored', done);
        s.off('session:new', done);
        resolve();
      };
      s.once('session:restored', done);
      s.once('session:new', done);
      setTimeout(done, 1200);
    });
  }
}

async function saveFinishedKifu(
  iAmFirst: boolean,
  history: SbnwAdvisorRound[],
): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:silperBnw:save', { iAmFirst, history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function formatTiles(tiles: SBNWTile[]): string {
  if (tiles.length === 0) return '—';
  return tiles.join('');
}

function poolLabel(pool: Record<SBNWTile, number>): string {
  return SBNW_TILES.map((t) => `${t}×${pool[t] ?? 0}`).join(' · ');
}

function leftover(
  pool: Record<SBNWTile, number>,
  draft: SBNWTile[],
): Record<SBNWTile, number> {
  const next = { 0: pool[0] ?? 0, 1: pool[1] ?? 0, 2: pool[2] ?? 0, 3: pool[3] ?? 0, 4: pool[4] ?? 0 };
  for (const t of draft) next[t] -= 1;
  return next;
}

function roundWinner(my: SBNWTile[], opp: SBNWTile[]): 'me' | 'opp' | 'draw' {
  const a = sbnwTilesToValue(my);
  const b = sbnwTilesToValue(opp);
  if (a > b) return 'me';
  if (b > a) return 'opp';
  return 'draw';
}

function TileDraft({
  label,
  pool,
  value,
  onChange,
  disabled,
}: {
  label: string;
  pool: Record<SBNWTile, number>;
  value: SBNWTile[];
  onChange: (tiles: SBNWTile[]) => void;
  disabled?: boolean;
}) {
  const left = leftover(pool, value);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-cdm-fg">{label}</span>
      <p className="text-xs text-cdm-fg-muted">{formatTiles(value) || '비어 있음'} · {value.length}자리</p>
      <div className="flex flex-wrap gap-2">
        {SBNW_TILES.map((t) => (
          <Button
            key={t}
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || (left[t] ?? 0) <= 0}
            onClick={() => onChange([...value, t])}
          >
            {t} ({left[t] ?? 0})
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled || value.length === 0}
          onClick={() => onChange(value.slice(0, -1))}
        >
          한 장 지우기
        </Button>
      </div>
    </div>
  );
}

export default function SilperBnwAdvisorClient() {
  const [iAmFirst, setIAmFirst] = useState<boolean | null>(null);
  const [history, setHistory] = useState<SbnwAdvisorRound[]>([]);
  const [pending, setPending] = useState<SbnwAdvisorPending>({});
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recommended, setRecommended] = useState<SBNWTile[] | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [myTiles, setMyTiles] = useState<SBNWTile[]>([]);
  const [oppTiles, setOppTiles] = useState<SBNWTile[]>([]);
  const [firstDigits, setFirstDigits] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (typeof stored.iAmFirst === 'boolean' && stored.history.length > 0) {
      const leftoverSnap = sbnwAdvisorSnapshot(stored.iAmFirst, stored.history);
      if (sbnwAdvisorFinished(leftoverSnap.result)) {
        void saveFinishedKifu(stored.iAmFirst, stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(
    () => (typeof iAmFirst === 'boolean' ? sbnwAdvisorSnapshot(iAmFirst, history) : null),
    [iAmFirst, history],
  );
  const ask = useMemo(
    () => (typeof iAmFirst === 'boolean' ? sbnwAdvisorAsk(iAmFirst, history, pending) : null),
    [iAmFirst, history, pending],
  );
  const playing = snap != null && snap.result.kind === 'playing';
  const over = snap != null && sbnwAdvisorFinished(snap.result);
  const overWinner = over && snap ? sbnwAdvisorWinnerFromResult(snap.result) : null;

  useEffect(() => {
    if (!ready) return;
    if (over && !savedId && typeof iAmFirst === 'boolean') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ iAmFirst, history, pending }));
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  }, [history, pending, ready, over, savedId, iAmFirst]);

  useEffect(() => {
    if (!ready || !over || !overWinner || savingRef.current || savedId) return;
    if (typeof iAmFirst !== 'boolean' || history.length === 0) return;
    savingRef.current = true;
    void saveFinishedKifu(iAmFirst, history)
      .then((id) => {
        sessionStorage.removeItem(STORAGE_KEY);
        setSavedId(id);
      })
      .catch((err) => {
        savingRef.current = false;
        toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
      });
  }, [ready, over, overWinner, iAmFirst, history, savedId]);

  useEffect(() => {
    if (!thinking) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - t0) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [thinking]);

  function clearRec() {
    setRecommended(null);
    setWinRate(null);
  }

  function resetRoundInputs() {
    setMyTiles([]);
    setOppTiles([]);
    setFirstDigits(null);
    setPending({});
    clearRec();
  }

  async function recommend(pendingArg?: SbnwAdvisorPending) {
    if (thinking || !playing || typeof iAmFirst !== 'boolean') return;
    const usePending = pendingArg ?? pending;
    const currentAsk = sbnwAdvisorAsk(iAmFirst, history, usePending);
    if (currentAsk === 'need-first-digits') {
      toast.error('선플 자릿수를 먼저 넣으세요.');
      return;
    }
    setThinking(true);
    clearRec();
    try {
      await ensureAdvisorSocket();
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(new Error('계산이 너무 오래 걸립니다. 소켓 서버를 확인하세요.'));
        }, 100_000);
        getSocket().emit(
          'superAi:silperBnw:recommend',
          { iAmFirst, history, pending: usePending },
          (res) => {
            clearTimeout(t);
            if (!res.success || !Array.isArray(res.tiles)) {
              reject(new Error(res.error ?? '수를 받지 못했습니다.'));
              return;
            }
            setRecommended(res.tiles);
            setMyTiles(res.tiles);
            setWinRate(typeof res.winRate === 'number' ? res.winRate : null);
            resolve();
          },
        );
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '수를 받지 못했습니다.');
    } finally {
      setThinking(false);
    }
  }

  function lockFirstSight() {
    if (firstDigits == null) {
      toast.error('선플 자릿수를 넣으세요.');
      return;
    }
    const next = { firstDigits };
    setPending(next);
    void recommend(next);
  }

  function commitRound() {
    if (!snap || myTiles.length === 0 || oppTiles.length === 0) {
      toast.error('나와 상대 타일을 모두 넣으세요.');
      return;
    }
    if (!sbnwValidateTiles(myTiles, snap.my.tiles)) {
      toast.error('내 타일이 잔여와 맞지 않습니다.');
      return;
    }
    if (!sbnwValidateTiles(oppTiles, snap.opp.tiles)) {
      toast.error('상대 타일이 잔여와 맞지 않습니다.');
      return;
    }
    setHistory((h) => [
      ...h,
      {
        rematchIndex: snap.rematchIndex,
        iWasFirst: snap.iAmFirst,
        myTiles,
        oppTiles,
      },
    ]);
    resetRoundInputs();
  }

  const digitMax = snap ? Math.min(10, Math.max(1, snap.opp.tileCount)) : 1;
  const preview = myTiles.length > 0 && oppTiles.length > 0 ? roundWinner(myTiles, oppTiles) : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">실퍼의 흑과백 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 타일만 받는다. 후플은 자릿수만 본다. 한 라운드가 아니라
          6선승 운영을 이긴다.
        </p>
      </div>

      {iAmFirst === null ? (
        <Card>
          <p className="mb-3 text-sm text-cdm-fg-muted">1라운드 선플이 나인가?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setIAmFirst(true)}>
              내가 선플
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIAmFirst(false)}>
              상대가 선플
            </Button>
          </div>
        </Card>
      ) : snap ? (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>R{snap.round}</Tag>
              {snap.rematchIndex > 0 && <Tag>재대결 {snap.rematchIndex}</Tag>}
              <Tag>{snap.iAmFirst ? '내 선플' : '내 후플'}</Tag>
              <span className="text-sm text-cdm-fg">
                나 {snap.my.score}/{SBNW_MAX_SCORE} · {snap.my.tileCount}장
              </span>
              <span className="text-sm text-cdm-fg-muted">
                상대 {snap.opp.score}/{SBNW_MAX_SCORE} · {snap.opp.tileCount}장
              </span>
            </div>
            <p className="text-xs text-cdm-fg-muted">내 타일 {poolLabel(snap.my.tiles)}</p>
            <p className="text-xs text-cdm-fg-muted">상대 타일 {poolLabel(snap.opp.tiles)}</p>
          </Card>

          {playing && (
            <>
              {!snap.iAmFirst && ask === 'need-first-digits' && (
                <Card className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-cdm-fg">선플이 낸 자릿수</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: digitMax }, (_, i) => i + 1).map((n) => (
                      <Button
                        key={n}
                        type="button"
                        size="sm"
                        variant={firstDigits === n ? 'primary' : 'secondary'}
                        disabled={thinking}
                        onClick={() => setFirstDigits(n)}
                      >
                        {n}자리
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-cdm-fg-muted">
                    값은 모른다. 자리만 본다. 선보다 짧으면 접는다.
                  </p>
                  <Button
                    type="button"
                    onClick={lockFirstSight}
                    disabled={thinking || firstDigits == null}
                  >
                    이 정보로 수 받기
                  </Button>
                </Card>
              )}

              {ask !== 'need-first-digits' && (
                <>
                  {pending.firstDigits != null && (
                    <p className="text-sm text-cdm-fg-muted">선플 {pending.firstDigits}자리</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" onClick={() => void recommend()} disabled={thinking}>
                      {thinking ? '계산 중' : '수 받기'}
                    </Button>
                    {thinking && (
                      <span className="inline-flex items-center gap-2 text-sm text-cdm-fg-muted">
                        <Spinner size="sm" /> {elapsed}초 / 90초
                      </span>
                    )}
                    {winRate != null && (
                      <span className="text-sm text-cdm-fg-muted">
                        게임 승률 {(winRate * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-6 sm:flex-row">
                <TileDraft
                  label={recommended ? `낼 타일 (추천 ${formatTiles(recommended)})` : '낼 타일'}
                  pool={snap.my.tiles}
                  value={myTiles}
                  onChange={setMyTiles}
                  disabled={thinking}
                />
                <TileDraft
                  label="공개된 상대 타일"
                  pool={snap.opp.tiles}
                  value={oppTiles}
                  onChange={setOppTiles}
                  disabled={thinking}
                />
              </div>

              {preview && (
                <p className="text-sm text-cdm-fg-muted">
                  나 {formatTiles(myTiles)} vs 상대 {formatTiles(oppTiles)}
                  {preview === 'me'
                    ? ' · 이번 라운드 나 승'
                    : preview === 'opp'
                      ? ' · 이번 라운드 상대 승'
                      : ' · 이번 라운드 무'}
                </p>
              )}

              <Button
                type="button"
                onClick={commitRound}
                disabled={thinking || myTiles.length === 0 || oppTiles.length === 0}
              >
                이 라운드 기록
              </Button>
            </>
          )}

          {history.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-cdm-fg-muted">
              {history.map((rec, i) => {
                const w = roundWinner(rec.myTiles, rec.oppTiles);
                return (
                  <li key={i}>
                    R{i + 1}
                    {rec.rematchIndex > 0 ? ` 재${rec.rematchIndex}` : ''}{' '}
                    {rec.iWasFirst ? '선' : '후'} {formatTiles(rec.myTiles)} vs {formatTiles(rec.oppTiles)}
                    {w === 'me' ? ' · 승' : w === 'opp' ? ' · 패' : ' · 무'}
                  </li>
                );
              })}
            </ul>
          )}

          {over && (
            <Card className="flex flex-col gap-3">
              <p className="font-medium text-cdm-fg">
                {overWinner === 'me' ? '나 승' : overWinner === 'opp' ? '상대 승' : '무승부'}
                {snap.result.kind !== 'playing' ? ` · ${snap.result.reason}` : ''}
              </p>
              {savedId ? (
                <Link href={`/super-ai/${savedId}`} className="text-sm text-cdm-accent">
                  기보 보기
                </Link>
              ) : (
                <p className="text-sm text-cdm-fg-muted">기보 저장 중…</p>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setHistory([]);
                  setSavedId(null);
                  savingRef.current = false;
                  resetRoundInputs();
                  setIAmFirst(null);
                }}
              >
                새 판
              </Button>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
