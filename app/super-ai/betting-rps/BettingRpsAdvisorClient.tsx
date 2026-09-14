'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  BRPS_INITIAL_CHIPS,
  BRPS_RESULTS,
  brpsAdvisorAsk,
  brpsAdvisorFinished,
  brpsAdvisorSnapshot,
  brpsAdvisorWinnerFromResult,
  brpsApplyRound,
  brpsJudgeBet,
  brpsMatchWinBonus,
  type BRPSResult,
  type BrpsAdvisorPending,
  type BrpsAdvisorRound,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-brps-advisor-v1';

const RESULT_LABEL: Record<BRPSResult, string> = {
  win: '승',
  draw: '무',
  lose: '패',
};

const ROLE_LABEL = { match: '승부', bet: '베팅' } as const;

type Rec =
  | { kind: 'role'; role: 'match' | 'bet' }
  | { kind: 'match'; result: BRPSResult }
  | { kind: 'bet'; prediction: BRPSResult; chips: number };

type Stored = {
  iAmFirst: boolean | null;
  history: BrpsAdvisorRound[];
  pending: BrpsAdvisorPending;
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
  history: BrpsAdvisorRound[],
): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:bettingRps:save', { iAmFirst, history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function ResultPick({
  value,
  onChange,
  disabled,
}: {
  value: BRPSResult | null;
  onChange: (v: BRPSResult) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {BRPS_RESULTS.map((r) => (
        <Button
          key={r}
          type="button"
          size="sm"
          variant={value === r ? 'primary' : 'secondary'}
          disabled={disabled}
          onClick={() => onChange(r)}
        >
          {RESULT_LABEL[r]}
        </Button>
      ))}
    </div>
  );
}

function RolePick({
  value,
  onChange,
  disabled,
  matchOnly,
}: {
  value: 'match' | 'bet' | null;
  onChange: (v: 'match' | 'bet') => void;
  disabled?: boolean;
  matchOnly?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={value === 'match' ? 'primary' : 'secondary'}
        disabled={disabled}
        onClick={() => onChange('match')}
      >
        승부
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === 'bet' ? 'primary' : 'secondary'}
        disabled={disabled || matchOnly}
        onClick={() => onChange('bet')}
      >
        베팅
      </Button>
    </div>
  );
}

function ChipPick({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number | null;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  if (max <= 0) {
    return <p className="text-sm text-cdm-fg-muted">칩이 없어 0칩만 걸 수 있다.</p>;
  }
  const opts: number[] = [];
  const cap = Math.min(max, 24);
  for (let n = 1; n <= cap; n++) opts.push(n);
  if (max > cap) opts.push(max);
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((n) => (
        <Button
          key={n}
          type="button"
          size="sm"
          variant={value === n ? 'primary' : 'secondary'}
          disabled={disabled}
          onClick={() => onChange(n)}
        >
          {n}
        </Button>
      ))}
    </div>
  );
}

export default function BettingRpsAdvisorClient() {
  const [iAmFirst, setIAmFirst] = useState<boolean | null>(null);
  const [history, setHistory] = useState<BrpsAdvisorRound[]>([]);
  const [pending, setPending] = useState<BrpsAdvisorPending>({});
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recommended, setRecommended] = useState<Rec | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [myRole, setMyRole] = useState<'match' | 'bet' | null>(null);
  const [oppRole, setOppRole] = useState<'match' | 'bet' | null>(null);
  const [matchResult, setMatchResult] = useState<BRPSResult | null>(null);
  const [prediction, setPrediction] = useState<BRPSResult | null>(null);
  const [betChips, setBetChips] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (typeof stored.iAmFirst === 'boolean') {
      const leftoverSnap = brpsAdvisorSnapshot(stored.iAmFirst, stored.history);
      if (brpsAdvisorFinished(leftoverSnap.result) && stored.history.length > 0) {
        void saveFinishedKifu(stored.iAmFirst, stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(
    () =>
      typeof iAmFirst === 'boolean'
        ? brpsAdvisorSnapshot(iAmFirst, history)
        : {
            round: 1,
            myChips: BRPS_INITIAL_CHIPS,
            oppChips: BRPS_INITIAL_CHIPS,
            iAmFirst: true,
            myChoiceRight: true,
            result: { kind: 'playing' as const },
          },
    [iAmFirst, history],
  );
  const ask =
    typeof iAmFirst === 'boolean' ? brpsAdvisorAsk(iAmFirst, history, pending) : 'finished';
  const playing = typeof iAmFirst === 'boolean' && snap.result.kind === 'playing';
  const over = typeof iAmFirst === 'boolean' && brpsAdvisorFinished(snap.result);
  const overWinner = over ? brpsAdvisorWinnerFromResult(snap.result) : null;
  const matchOnly = snap.myChips <= 0 || snap.oppChips <= 0;
  const myLockedRole: 'match' | 'bet' | null =
    ask === 'match' || ask === 'bet' ? ask : pending.myRole ?? null;

  useEffect(() => {
    if (!ready) return;
    if (over && !savedId && typeof iAmFirst === 'boolean') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ iAmFirst, history, pending }));
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  }, [iAmFirst, history, pending, ready, over, savedId]);

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

  useEffect(() => {
    if (!playing || !matchOnly) return;
    if (snap.myChoiceRight && !pending.myRole) {
      setPending((p) => ({ ...p, myRole: 'match' }));
      setMyRole('match');
    }
    if (!snap.myChoiceRight && !pending.oppRole) {
      setPending((p) => ({ ...p, oppRole: 'match' }));
      setOppRole('match');
    }
  }, [playing, matchOnly, snap.myChoiceRight, pending.myRole, pending.oppRole]);

  useEffect(() => {
    if (myLockedRole === 'match' && snap.oppChips <= 0) setBetChips(0);
    if (myLockedRole === 'bet' && snap.myChips <= 0) setBetChips(0);
  }, [myLockedRole, snap.oppChips, snap.myChips]);

  function clearRec() {
    setRecommended(null);
    setWinRate(null);
  }

  function resetRoundInputs() {
    setMatchResult(null);
    setPrediction(null);
    setBetChips(null);
  }

  async function recommend() {
    if (thinking || !playing || typeof iAmFirst !== 'boolean') return;
    if (ask === 'need-opp-role') {
      toast.error('상대가 고른 역할을 먼저 넣으세요.');
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
          'superAi:bettingRps:recommend',
          { iAmFirst, history, pending },
          (res) => {
            clearTimeout(t);
            if (!res.success || !res.kind) {
              reject(new Error(res.error ?? '수를 고르지 못했습니다.'));
              return;
            }
            if (res.kind === 'role' && (res.role === 'match' || res.role === 'bet')) {
              const rec = { kind: 'role' as const, role: res.role };
              setRecommended(rec);
              setMyRole(res.role);
            } else if (res.kind === 'match' && res.result) {
              setRecommended({ kind: 'match', result: res.result });
              setMatchResult(res.result);
            } else if (res.kind === 'bet' && res.prediction && typeof res.chips === 'number') {
              setRecommended({ kind: 'bet', prediction: res.prediction, chips: res.chips });
              setPrediction(res.prediction);
              setBetChips(res.chips);
            } else {
              reject(new Error('수를 고르지 못했습니다.'));
              return;
            }
            setWinRate(res.winRate ?? null);
            resolve();
          },
        );
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '수를 고르지 못했습니다.');
    } finally {
      setThinking(false);
    }
  }

  function lockMyRole(role: 'match' | 'bet') {
    const next = matchOnly ? 'match' : role;
    setPending((p) => ({ ...p, myRole: next }));
    setMyRole(next);
    clearRec();
    resetRoundInputs();
  }

  function lockOppRole(role: 'match' | 'bet') {
    const next = matchOnly ? 'match' : role;
    setPending((p) => ({ ...p, oppRole: next }));
    setOppRole(next);
    clearRec();
    resetRoundInputs();
  }

  function recordRound() {
    if (!playing) return;
    const role = myLockedRole;
    if (!role) {
      toast.error('역할을 먼저 정하세요.');
      return;
    }
    if (role === 'match') {
      if (!matchResult || !prediction || betChips == null) {
        toast.error('내 승부 결과와 상대의 예측·칩을 모두 고르세요.');
        return;
      }
      if (betChips < 0) return;
      setHistory((prev) => [...prev, { myRole: 'match', matchResult, prediction, betChips }]);
    } else {
      if (!prediction || betChips == null || !matchResult) {
        toast.error('내 예측·칩과 상대의 승부 결과를 모두 고르세요.');
        return;
      }
      setHistory((prev) => [
        ...prev,
        { myRole: 'bet', matchResult, prediction, betChips },
      ]);
    }
    setPending({});
    setMyRole(null);
    setOppRole(null);
    clearRec();
    resetRoundInputs();
  }

  function undo() {
    if (over) return;
    if (pending.myRole || pending.oppRole) {
      setPending({});
      setMyRole(null);
      setOppRole(null);
      clearRec();
      resetRoundInputs();
      return;
    }
    setHistory((prev) => prev.slice(0, -1));
    clearRec();
    resetRoundInputs();
  }

  async function reset() {
    if (over && overWinner && !savedId && history.length > 0 && typeof iAmFirst === 'boolean') {
      try {
        savingRef.current = true;
        await saveFinishedKifu(iAmFirst, history);
      } catch (err) {
        savingRef.current = false;
        toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        return;
      }
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setIAmFirst(null);
    setHistory([]);
    setPending({});
    setSavedId(null);
    savingRef.current = false;
    setMyRole(null);
    setOppRole(null);
    clearRec();
    resetRoundInputs();
  }

  const recCopy = recommended
    ? recommended.kind === 'role'
      ? `역할 ${ROLE_LABEL[recommended.role]}`
      : recommended.kind === 'match'
        ? `승부 ${RESULT_LABEL[recommended.result]}`
        : `베팅 ${RESULT_LABEL[recommended.prediction]} ${recommended.chips}칩`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-xl font-bold text-cdm-fg">베팅! 가위바위보 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판의 상대가 아니다. 역할과 수를 알려 주면, 그걸 내고 공개된 상대 수를 넣는다.
          한 라운드 이득이 아니라 10라운드 칩 승률로 고른다.
        </p>
      </div>

      {typeof iAmFirst !== 'boolean' && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-cdm-fg">1라운드 선택권</h2>
          <p className="text-sm text-cdm-fg-muted">
            홀수 라운드는 선공, 짝수는 후공이다. 이번 판에서 당신이 먼저 역할을 고르면 선공이다.
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => setIAmFirst(true)}>
              내가 선공
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIAmFirst(false)}>
              상대가 선공
            </Button>
          </div>
        </Card>
      )}

      {typeof iAmFirst === 'boolean' && (
        <Card className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{playing ? `라운드 ${snap.round}` : '종료'}</Tag>
            <span className="text-sm text-cdm-fg">
              나 {snap.myChips}칩 · 상대 {snap.oppChips}칩
            </span>
            <span className="text-xs text-cdm-fg-muted">
              {iAmFirst ? '선공' : '후공'}
              {playing ? (snap.myChoiceRight ? ' · 내 선택권' : ' · 상대 선택권') : ''}
              {playing ? ` · 승 보너스 ${brpsMatchWinBonus(snap.round)}칩` : ''}
            </span>
          </div>
          {playing && ask === 'need-opp-role' && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-cdm-fg">상대가 고른 역할</span>
              <RolePick
                value={oppRole}
                onChange={lockOppRole}
                disabled={thinking}
                matchOnly={matchOnly}
              />
            </div>
          )}
          {playing && ask !== 'need-opp-role' && (
            <Button
              type="button"
              loading={thinking}
              disabled={thinking}
              onClick={() => void recommend()}
            >
              {thinking ? '수 고르는 중' : ask === 'role' ? '역할 받기' : '수 받기'}
            </Button>
          )}
          {thinking && (
            <div className="flex items-center gap-3 text-sm text-cdm-fg-muted">
              <Spinner size={16} label="계산 중" />
              <span>{elapsed}초 / 최대 90초. 이번 수는 동시 제출이라 상대 패는 보지 않는다.</span>
            </div>
          )}
          {recommended != null && playing && !thinking && recCopy && (
            <div className="flex flex-col gap-1">
              <p className="text-2xl font-bold text-cdm-fg">{recCopy}</p>
              {winRate != null && (
                <p className="text-sm text-cdm-fg-muted">
                  추정 승률 {Math.round(winRate * 100)}%
                </p>
              )}
              {recommended.kind === 'role' && (
                <div className="mt-2 flex flex-col gap-2">
                  <span className="text-sm font-medium text-cdm-fg">역할 확정</span>
                  <RolePick
                    value={myRole}
                    onChange={setMyRole}
                    disabled={thinking}
                    matchOnly={matchOnly}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!myRole}
                    onClick={() => myRole && lockMyRole(myRole)}
                  >
                    이 역할로 두기
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {playing && myLockedRole && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-cdm-fg">라운드 결과</h2>
          <p className="text-sm text-cdm-fg-muted">
            {myLockedRole === 'match'
              ? '받은 승부를 실제 판에 낸 뒤, 공개된 상대 예측과 칩만 넣는다. 성공·실패는 여기서 계산한다.'
              : '받은 예측과 칩을 실제 판에 낸 뒤, 공개된 상대 승부만 넣는다. 성공·실패는 여기서 계산한다.'}
          </p>
          {myLockedRole === 'match' ? (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-cdm-fg">내가 낸 승부</span>
                <ResultPick value={matchResult} onChange={setMatchResult} disabled={thinking} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-cdm-fg">상대 예측</span>
                <ResultPick value={prediction} onChange={setPrediction} disabled={thinking} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-cdm-fg">상대 칩</span>
                <ChipPick
                  value={betChips}
                  max={Math.max(snap.oppChips, betChips ?? 0)}
                  onChange={setBetChips}
                  disabled={thinking}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-cdm-fg">내 예측</span>
                <ResultPick value={prediction} onChange={setPrediction} disabled={thinking} />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-cdm-fg">내 칩</span>
                <ChipPick
                  value={betChips}
                  max={snap.myChips}
                  onChange={setBetChips}
                  disabled={thinking}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-cdm-fg">상대 승부</span>
                <ResultPick value={matchResult} onChange={setMatchResult} disabled={thinking} />
              </div>
            </>
          )}
          {matchResult && prediction && betChips != null && (
            <p className="text-sm text-cdm-fg-muted">
              베팅 {brpsJudgeBet(matchResult, prediction) === 'success'
                ? '성공'
                : brpsJudgeBet(matchResult, prediction) === 'fail'
                  ? '실패'
                  : '반환'}
              {(() => {
                const next = brpsApplyRound(
                  snap.round,
                  myLockedRole,
                  matchResult,
                  prediction,
                  betChips,
                  snap.myChips,
                  snap.oppChips,
                );
                return ` · 다음 나 ${next.myChips}칩 · 상대 ${next.oppChips}칩`;
              })()}
            </p>
          )}
          <Button type="button" variant="secondary" disabled={thinking} onClick={recordRound}>
            결과 기록
          </Button>
        </Card>
      )}

      {over && overWinner && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-cdm-fg">
            {overWinner === 'me' ? '승리' : overWinner === 'opp' ? '패배' : '무승부'}
          </h2>
          <p className="text-sm text-cdm-fg-muted">{snap.result.kind === 'playing' ? '' : snap.result.reason}</p>
          {savedId ? (
            <Link href={`/super-ai/${savedId}`} className="text-sm text-cdm-accent hover:underline">
              저장된 기보 보기
            </Link>
          ) : (
            <p className="text-xs text-cdm-fg-muted">기보 저장 중…</p>
          )}
        </Card>
      )}

      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-cdm-fg">기록</h2>
          <ul className="flex flex-col gap-2">
            {history.map((row, i) => {
              const before = brpsAdvisorSnapshot(iAmFirst ?? true, history.slice(0, i));
              const after = brpsApplyRound(
                i + 1,
                row.myRole,
                row.matchResult,
                row.prediction,
                row.betChips,
                before.myChips,
                before.oppChips,
              );
              return (
                <li key={`${i}-${row.myRole}-${row.matchResult}`}>
                  <Card className="text-sm text-cdm-fg">
                    R{i + 1} · 나 {ROLE_LABEL[row.myRole]}
                    {row.myRole === 'match'
                      ? ` ${RESULT_LABEL[row.matchResult]}`
                      : ` ${RESULT_LABEL[row.prediction]} ${row.betChips}칩`}
                    {' · 상대 '}
                    {row.myRole === 'match'
                      ? `${RESULT_LABEL[row.prediction]} ${row.betChips}칩`
                      : `승부 ${RESULT_LABEL[row.matchResult]}`}
                    {` · ${before.myChips}→${after.myChips} vs ${before.oppChips}→${after.oppChips}`}
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={(history.length === 0 && !pending.myRole && !pending.oppRole) || thinking || over}
          onClick={undo}
        >
          한 단계 취소
        </Button>
        <Button type="button" variant="ghost" disabled={thinking} onClick={() => void reset()}>
          새 판
        </Button>
      </div>
    </div>
  );
}
