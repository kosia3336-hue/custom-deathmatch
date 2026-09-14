'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  FT_MAX_SCORE,
  FT_TOWERS,
  ftAdvisorAsk,
  ftAdvisorFinished,
  ftAdvisorSnapshot,
  ftAdvisorWinnerFromResult,
  ftFormatAction,
  ftInferredBand,
  ftIsKnownGift,
  type FTAction,
  type FTStackCount,
  type FTTower,
  type FtAdvisorMeAction,
  type FtAdvisorOppSight,
  type FtAdvisorPly,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-ft-advisor-v1';

type Stored = { iAmFirst: boolean | null; history: FtAdvisorPly[] };

function loadStored(): Stored {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { iAmFirst: null, history: [] };
    const parsed = JSON.parse(raw) as Stored;
    if (typeof parsed.iAmFirst !== 'boolean' && parsed.iAmFirst !== null) {
      return { iAmFirst: null, history: [] };
    }
    if (!Array.isArray(parsed.history)) return { iAmFirst: null, history: [] };
    return { iAmFirst: parsed.iAmFirst, history: parsed.history };
  } catch {
    return { iAmFirst: null, history: [] };
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

async function saveFinishedKifu(iAmFirst: boolean, history: FtAdvisorPly[]): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:fiveTowers:save', { iAmFirst, history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function plyLabel(ply: FtAdvisorPly): string {
  if (ply.by === 'me' && ply.me) {
    const a = ply.me;
    if (a.kind === 'stack') return `쌓기 ${a.tower} ${a.count}칸`;
    if (a.kind === 'info') return `정보 ${a.targets[0]}+${a.targets[1]} 합 ${a.sumAtTime}`;
    if (a.kind === 'zero') return `제로 ${a.tower}`;
    return `시크릿 ${a.tower} ${a.count}칸`;
  }
  if (ply.by === 'opp' && ply.opp) {
    const o = ply.opp;
    if (o.kind === 'stack') return `공개 쌓기 ${o.tower}`;
    if (o.kind === 'secret-hidden') return '시크릿(숨김)';
    return `시크릿 공개 ${o.tower}`;
  }
  return '수';
}

export default function FiveTowersAdvisorClient() {
  const [iAmFirst, setIAmFirst] = useState<boolean | null>(null);
  const [history, setHistory] = useState<FtAdvisorPly[]>([]);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recommended, setRecommended] = useState<FTAction | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [tab, setTab] = useState<'stack' | 'item'>('stack');
  const [tower, setTower] = useState<FTTower | null>(null);
  const [count, setCount] = useState<FTStackCount>(2);
  const [item, setItem] = useState<'info' | 'zero' | 'secret' | null>(null);
  const [infoTargets, setInfoTargets] = useState<FTTower[]>([]);
  const [infoSum, setInfoSum] = useState<number | null>(null);
  const [half, setHalf] = useState<FTTower | null>(null);
  const [complete, setComplete] = useState<FTTower | null>(null);
  const [oppKind, setOppKind] = useState<'stack' | 'secret-hidden' | 'secret-revealed'>('stack');
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (typeof stored.iAmFirst === 'boolean' && stored.history.length > 0) {
      const leftover = ftAdvisorSnapshot(stored.iAmFirst, stored.history);
      if (ftAdvisorFinished(leftover.result)) {
        void saveFinishedKifu(stored.iAmFirst, stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(
    () => (typeof iAmFirst === 'boolean' ? ftAdvisorSnapshot(iAmFirst, history) : null),
    [iAmFirst, history],
  );
  const ask = useMemo(
    () => (typeof iAmFirst === 'boolean' ? ftAdvisorAsk(iAmFirst, history) : null),
    [iAmFirst, history],
  );
  const playing = snap != null && snap.result.kind === 'playing';
  const over = snap != null && ftAdvisorFinished(snap.result);
  const overWinner = over && snap ? ftAdvisorWinnerFromResult(snap.result) : null;

  useEffect(() => {
    if (!ready) return;
    if (over && !savedId && typeof iAmFirst === 'boolean') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ iAmFirst, history }));
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  }, [history, ready, over, savedId, iAmFirst]);

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

  function resetInputs() {
    setRecommended(null);
    setWinRate(null);
    setTab('stack');
    setTower(null);
    setCount(2);
    setItem(null);
    setInfoTargets([]);
    setInfoSum(null);
    setHalf(null);
    setComplete(null);
    setOppKind('stack');
  }

  async function recommend() {
    if (thinking || !playing || typeof iAmFirst !== 'boolean') return;
    if (ask !== 'my-turn') {
      toast.error('내 차례가 아닙니다.');
      return;
    }
    setThinking(true);
    setRecommended(null);
    setWinRate(null);
    try {
      await ensureAdvisorSocket();
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(new Error('계산이 너무 오래 걸립니다. 소켓 서버를 확인하세요.'));
        }, 100_000);
        getSocket().emit('superAi:fiveTowers:recommend', { iAmFirst, history }, (res) => {
          clearTimeout(t);
          if (!res.success || !res.action) {
            reject(new Error(res.error ?? '수를 받지 못했습니다.'));
            return;
          }
          setRecommended(res.action);
          setWinRate(typeof res.winRate === 'number' ? res.winRate : null);
          if (res.action.type === 'stack') {
            setTab('stack');
            setTower(res.action.tower);
            setCount(res.action.count);
            setItem(null);
          } else {
            setTab('item');
            setItem(res.action.item);
            if (res.action.item === 'info') {
              setInfoTargets([...res.action.targets]);
              setTower(null);
            } else {
              setTower(res.action.target);
              if (res.action.item === 'secret') setCount(res.action.count);
            }
          }
          resolve();
        });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '수를 받지 못했습니다.');
    } finally {
      setThinking(false);
    }
  }

  function commitMine() {
    if (!snap) return;
    let me: FtAdvisorMeAction | null = null;
    if (tab === 'stack') {
      if (!tower) {
        toast.error('탑을 고르세요.');
        return;
      }
      if (ftIsKnownGift(snap, tower, count)) {
        toast.error('높이가 확정인데 1~2칸을 남기면 상대 점수다.');
        return;
      }
      me = { kind: 'stack', tower, count };
    } else {
      if (!item) {
        toast.error('아이템을 고르세요.');
        return;
      }
      if (snap.itemUsed) {
        toast.error('아이템은 이미 썼습니다.');
        return;
      }
      if (item === 'info') {
        if (infoTargets.length !== 2) {
          toast.error('정보 대상 두 탑을 고르세요.');
          return;
        }
        if (infoSum == null) {
          toast.error('정보 합을 넣으세요.');
          return;
        }
        me = { kind: 'info', targets: [infoTargets[0]!, infoTargets[1]!], sumAtTime: infoSum };
      } else if (item === 'zero') {
        if (!tower) {
          toast.error('탑을 고르세요.');
          return;
        }
        me = { kind: 'zero', tower };
      } else {
        if (!tower) {
          toast.error('탑을 고르세요.');
          return;
        }
        me = { kind: 'secret', tower, count };
      }
    }
    setHistory((h) => [...h, { by: 'me', me, half, complete }]);
    resetInputs();
  }

  function commitOpp() {
    let opp: FtAdvisorOppSight | null = null;
    if (oppKind === 'secret-hidden') opp = { kind: 'secret-hidden' };
    else if (oppKind === 'secret-revealed') {
      if (!tower) {
        toast.error('공개된 탑을 고르세요.');
        return;
      }
      opp = { kind: 'secret-revealed', tower };
    } else {
      if (!tower) {
        toast.error('상대가 쌓은 탑을 고르세요.');
        return;
      }
      opp = { kind: 'stack', tower };
    }
    setHistory((h) => [...h, { by: 'opp', opp, half, complete }]);
    resetInputs();
  }

  const live = snap ? FT_TOWERS.filter((t) => !snap.towers[t].completed) : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">5개의 탑 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 행동만 받는다. 진짜 높이는 없다. 한 수가 아니라 3점을 이긴다.
        </p>
      </div>

      {iAmFirst === null ? (
        <Card>
          <p className="mb-3 text-sm text-cdm-fg-muted">선공이 나인가?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setIAmFirst(true)}>
              내가 선공
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIAmFirst(false)}>
              상대가 선공
            </Button>
          </div>
        </Card>
      ) : snap ? (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>{snap.turn}턴</Tag>
              <Tag>{snap.iAmToMove ? '내 차례' : '상대 차례'}</Tag>
              <span className="text-sm text-cdm-fg">
                나 {snap.myScore}/{FT_MAX_SCORE}
              </span>
              <span className="text-sm text-cdm-fg-muted">
                상대 {snap.oppScore}/{FT_MAX_SCORE}
              </span>
              {snap.itemUsed && <span className="text-xs text-cdm-fg-muted">아이템 {snap.myItemUsedKind}</span>}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {FT_TOWERS.map((t) => {
                const pub = snap.towers[t];
                const band = ftInferredBand(snap, t);
                return (
                  <div
                    key={t}
                    className="rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-2 py-2 text-center"
                  >
                    <div className="text-sm font-semibold text-cdm-fg">{t}</div>
                    <div className="text-[11px] text-cdm-fg-muted">
                      {pub.completed ? '완성' : pub.milestonesReached.half ? '6+' : '0–5'}
                    </div>
                    <div className="text-[11px] tabular-nums text-cdm-fg-muted">
                      내 {snap.myStacked[t]} · {band.lo}–{band.hi}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {playing && ask === 'my-turn' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void recommend()} disabled={thinking}>
                  {thinking ? '계산 중' : '수 받기'}
                </Button>
                {thinking && (
                  <span className="inline-flex items-center gap-2 text-sm text-cdm-fg-muted">
                    <Spinner size="sm" /> {elapsed}초 / 90초
                  </span>
                )}
                {recommended && (
                  <span className="text-sm text-cdm-fg">추천 {ftFormatAction(recommended)}</span>
                )}
                {winRate != null && (
                  <span className="text-sm text-cdm-fg-muted">
                    게임 승률 {(winRate * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              <div className="flex gap-1 rounded-cdm-md bg-cdm-bg-elev-1 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={tab === 'stack' ? 'primary' : 'secondary'}
                  onClick={() => { setTab('stack'); setItem(null); }}
                >
                  쌓기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={tab === 'item' ? 'primary' : 'secondary'}
                  disabled={snap.itemUsed}
                  onClick={() => setTab('item')}
                >
                  아이템
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {live.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={tower === t || infoTargets.includes(t) ? 'primary' : 'secondary'}
                    onClick={() => {
                      if (tab === 'item' && item === 'info') {
                        setInfoTargets((cur) => {
                          if (cur.includes(t)) return cur.filter((x) => x !== t);
                          if (cur.length >= 2) return [cur[1]!, t];
                          return [...cur, t];
                        });
                      } else {
                        setTower(t);
                      }
                    }}
                  >
                    {t}
                  </Button>
                ))}
              </div>

              {tab === 'stack' && (
                <div className="flex flex-wrap gap-2">
                  {([1, 2, 3] as FTStackCount[]).map((c) => (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant={count === c ? 'primary' : 'secondary'}
                      onClick={() => setCount(c)}
                    >
                      {c}칸
                    </Button>
                  ))}
                </div>
              )}

              {tab === 'item' && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(['info', 'zero', 'secret'] as const).map((it) => (
                      <Button
                        key={it}
                        type="button"
                        size="sm"
                        variant={item === it ? 'primary' : 'secondary'}
                        onClick={() => setItem(it)}
                      >
                        {it === 'info' ? '정보' : it === 'zero' ? '제로' : '시크릿'}
                      </Button>
                    ))}
                  </div>
                  {item === 'secret' && (
                    <div className="flex flex-wrap gap-2">
                      {([1, 2, 3] as FTStackCount[]).map((c) => (
                        <Button
                          key={c}
                          type="button"
                          size="sm"
                          variant={count === c ? 'primary' : 'secondary'}
                          onClick={() => setCount(c)}
                        >
                          {c}칸
                        </Button>
                      ))}
                    </div>
                  )}
                  {item === 'info' && (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium text-cdm-fg">정보 합</span>
                      <input
                        type="number"
                        min={0}
                        max={22}
                        value={infoSum ?? ''}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          setInfoSum(Math.max(0, Math.min(22, Math.round(n))));
                        }}
                        className="h-10 w-32 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 text-cdm-fg tabular-nums"
                      />
                    </label>
                  )}
                </>
              )}

              <p className="text-xs text-cdm-fg-muted">이 수 직후 HUD에 6칸/완성이 떴으면 고른다. 내 기여만으로 확정이면 자동이다.</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-cdm-fg-muted">6칸</span>
                {live.map((t) => (
                  <Button
                    key={`h-${t}`}
                    type="button"
                    size="sm"
                    variant={half === t ? 'primary' : 'secondary'}
                    onClick={() => setHalf(half === t ? null : t)}
                  >
                    {t}
                  </Button>
                ))}
                <span className="text-sm text-cdm-fg-muted">완성</span>
                {live.map((t) => (
                  <Button
                    key={`c-${t}`}
                    type="button"
                    size="sm"
                    variant={complete === t ? 'primary' : 'secondary'}
                    onClick={() => setComplete(complete === t ? null : t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>

              <Button type="button" onClick={commitMine} disabled={thinking}>
                이 수 기록
              </Button>
            </>
          )}

          {playing && ask === 'opp-turn' && (
            <Card className="flex flex-col gap-3">
              <p className="text-sm font-medium text-cdm-fg">상대가 보이게 한 수 (칸 수는 모름)</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={oppKind === 'stack' ? 'primary' : 'secondary'}
                  onClick={() => setOppKind('stack')}
                >
                  공개 쌓기
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={oppKind === 'secret-hidden' ? 'primary' : 'secondary'}
                  onClick={() => setOppKind('secret-hidden')}
                >
                  시크릿(숨김)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={oppKind === 'secret-revealed' ? 'primary' : 'secondary'}
                  onClick={() => setOppKind('secret-revealed')}
                >
                  시크릿 공개
                </Button>
              </div>
              {oppKind !== 'secret-hidden' && (
                <div className="flex flex-wrap gap-2">
                  {live.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={tower === t ? 'primary' : 'secondary'}
                      onClick={() => setTower(t)}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-cdm-fg-muted">6칸</span>
                {live.map((t) => (
                  <Button
                    key={`oh-${t}`}
                    type="button"
                    size="sm"
                    variant={half === t ? 'primary' : 'secondary'}
                    onClick={() => setHalf(half === t ? null : t)}
                  >
                    {t}
                  </Button>
                ))}
                <span className="text-sm text-cdm-fg-muted">완성</span>
                {live.map((t) => (
                  <Button
                    key={`oc-${t}`}
                    type="button"
                    size="sm"
                    variant={complete === t ? 'primary' : 'secondary'}
                    onClick={() => setComplete(complete === t ? null : t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <Button type="button" onClick={commitOpp}>
                상대 수 기록
              </Button>
            </Card>
          )}

          {history.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-cdm-fg-muted">
              {history.map((ply, i) => (
                <li key={i}>
                  {i + 1}. {ply.by === 'me' ? '나' : '상대'} {plyLabel(ply)}
                  {ply.half ? ` · 6칸 ${ply.half}` : ''}
                  {ply.complete ? ` · 완성 ${ply.complete}` : ''}
                </li>
              ))}
            </ul>
          )}

          {over && (
            <Card className="flex flex-col gap-3">
              <p className="font-medium text-cdm-fg">
                {overWinner === 'me' ? '나 승' : '상대 승'}
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
                  resetInputs();
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
