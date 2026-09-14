'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  BANK_DENOMINATIONS,
  bankAdvisorAsk,
  bankAdvisorFinished,
  bankAdvisorRoundLegal,
  bankAdvisorSnapshot,
  bankAdvisorWinnerFromResult,
  bankSumBetAmount,
  bankSumBetCount,
  bankZeroBet,
  type BankAdvisorOutcome,
  type BankAdvisorPending,
  type BankAdvisorRound,
  type BankBet,
  type BankDenomination,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-bank-advisor-v1';
const DENOM_LABEL: Record<BankDenomination, string> = {
  1000: '1천',
  3000: '3천',
  5000: '5천',
  10000: '1만',
};

type Stored = {
  iAmFirst: boolean | null;
  history: BankAdvisorRound[];
  pending: BankAdvisorPending;
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
  history: BankAdvisorRound[],
): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:bankGame:save', { iAmFirst, history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function BetRow({
  value,
  max,
  onChange,
  disabled,
}: {
  value: BankBet;
  max: BankBet;
  onChange: (v: BankBet) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {BANK_DENOMINATIONS.map((d) => (
        <label key={d} className="flex flex-col gap-1 text-sm">
          <span className="text-cdm-fg-muted">{DENOM_LABEL[d]}</span>
          <input
            type="number"
            min={0}
            max={max[d]}
            disabled={disabled}
            value={value[d]}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onChange({
                ...value,
                [d]: Math.max(0, Math.min(max[d], Math.floor(n))),
              });
            }}
            className="h-10 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-2 text-cdm-fg tabular-nums"
          />
          <span className="text-xs text-cdm-fg-muted">잔 {max[d]}</span>
        </label>
      ))}
    </div>
  );
}

export default function BankGameAdvisorClient() {
  const [iAmFirst, setIAmFirst] = useState<boolean | null>(null);
  const [history, setHistory] = useState<BankAdvisorRound[]>([]);
  const [pending, setPending] = useState<BankAdvisorPending>({});
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [myBet, setMyBet] = useState<BankBet>(bankZeroBet());
  const [firstCount, setFirstCount] = useState(0);
  const [oppCount, setOppCount] = useState(0);
  const [outcome, setOutcome] = useState<BankAdvisorOutcome | null>(null);
  const [oppAmount, setOppAmount] = useState(0);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (typeof stored.iAmFirst === 'boolean' && stored.history.length > 0) {
      const leftover = bankAdvisorSnapshot(stored.iAmFirst, stored.history);
      if (bankAdvisorFinished(leftover.result)) {
        void saveFinishedKifu(stored.iAmFirst, stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(
    () => (typeof iAmFirst === 'boolean' ? bankAdvisorSnapshot(iAmFirst, history) : null),
    [iAmFirst, history],
  );
  const ask = useMemo(
    () => (typeof iAmFirst === 'boolean' ? bankAdvisorAsk(iAmFirst, history, pending) : null),
    [iAmFirst, history, pending],
  );
  const playing = snap != null && snap.result.kind === 'playing';
  const over = snap != null && bankAdvisorFinished(snap.result);
  const overWinner = over && snap ? bankAdvisorWinnerFromResult(snap.result) : null;

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

  function resetRoundInputs() {
    setPending({});
    setMyBet(bankZeroBet());
    setFirstCount(0);
    setOppCount(0);
    setOutcome(null);
    setOppAmount(0);
    setWinRate(null);
  }

  async function recommend(pendingArg?: BankAdvisorPending) {
    if (thinking || !playing || typeof iAmFirst !== 'boolean') return;
    const usePending = pendingArg ?? pending;
    const currentAsk = bankAdvisorAsk(iAmFirst, history, usePending);
    if (currentAsk !== 'betFirst' && currentAsk !== 'betSecond') {
      toast.error('공개된 값을 먼저 넣으세요.');
      return;
    }
    setThinking(true);
    setWinRate(null);
    try {
      await ensureAdvisorSocket();
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(new Error('계산이 너무 오래 걸립니다. 소켓 서버를 확인하세요.'));
        }, 100_000);
        getSocket().emit(
          'superAi:bankGame:recommend',
          { iAmFirst, history, pending: usePending },
          (res) => {
            clearTimeout(t);
            if (!res.success || !res.bet) {
              reject(new Error(res.error ?? '수를 받지 못했습니다.'));
              return;
            }
            setMyBet(res.bet);
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

  function lockFirstCount() {
    const next = { ...pending, firstCount };
    setPending(next);
    void recommend(next);
  }

  function lockMyBet() {
    setPending((p) => ({ ...p, myBet }));
  }

  function commitRound() {
    if (!snap || typeof iAmFirst !== 'boolean' || !pending.myBet || !outcome) {
      toast.error('베팅과 결과를 모두 넣으세요.');
      return;
    }
    const count = snap.iAmFirst ? oppCount : (pending.firstCount ?? 0);
    const rec: BankAdvisorRound = {
      myBet: pending.myBet,
      oppCount: count,
      outcome,
      oppAmount: outcome === 'loss' ? null : (outcome === 'draw' ? bankSumBetAmount(pending.myBet) : oppAmount),
    };
    if (!bankAdvisorRoundLegal(snap, rec)) {
      toast.error('장수·금액이 올바르지 않습니다. 내가 지면 상대 금액은 비워 두세요.');
      return;
    }
    setHistory((h) => [...h, rec]);
    resetRoundInputs();
  }

  if (!ready) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">은행놀이 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 베팅만 받는다. 상대 권종과 승자 금액은 모른다.
          한 라운드가 아니라 9라운드 점수로 이긴다.
        </p>
      </div>

      {iAmFirst == null ? (
        <Card>
          <p className="mb-3 text-sm text-cdm-fg-muted">1라운드 선 제출이 나인가?</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => setIAmFirst(true)}>내가 선</Button>
            <Button type="button" variant="secondary" onClick={() => setIAmFirst(false)}>상대가 선</Button>
          </div>
        </Card>
      ) : null}

      {snap ? (
        <Card>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Tag>{`R${Math.min(snap.round, snap.maxRound)} / ${snap.maxRound}`}</Tag>
            <Tag>{snap.iAmFirst ? '이번 선' : '이번 후'}</Tag>
            <span className="text-cdm-fg">점수 {snap.my.score} vs {snap.opp.score}</span>
            <span className="text-cdm-fg-muted">
              내 잔여 {snap.my.inventoryCount}장 {snap.my.inventoryAmount.toLocaleString()}원
            </span>
            <span className="text-cdm-fg-muted">상대 장수 {snap.opp.inventoryCount}</span>
          </div>
          {thinking ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-cdm-accent">
              <Spinner size={16} /> 생각 중 {elapsed}초
            </p>
          ) : null}
          {winRate != null ? (
            <p className="mt-2 text-sm text-cdm-fg">게임 승률 추정 {(winRate * 100).toFixed(0)}%</p>
          ) : null}
        </Card>
      ) : null}

      {playing && ask === 'need-first-count' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">선이 낸 장수 (공개)</p>
          <input
            type="number"
            min={0}
            max={snap?.opp.inventoryCount ?? 38}
            value={firstCount}
            onChange={(e) => setFirstCount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            className="h-10 w-32 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-2 text-cdm-fg tabular-nums"
          />
          <Button type="button" className="mt-4" onClick={lockFirstCount} disabled={thinking}>
            넣고 후 베팅 추천
          </Button>
        </Card>
      ) : null}

      {playing && (ask === 'betFirst' || ask === 'betSecond') && snap ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">{ask === 'betFirst' ? '선 베팅' : '후 베팅'}</p>
          <BetRow value={myBet} max={snap.my.inventory} onChange={setMyBet} disabled={thinking} />
          <p className="mt-2 text-sm text-cdm-fg-muted">
            {bankSumBetCount(myBet)}장 · {bankSumBetAmount(myBet).toLocaleString()}원
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void recommend()} disabled={thinking}>추천 받기</Button>
            <Button type="button" variant="secondary" onClick={lockMyBet} disabled={thinking}>이 베팅으로 확정</Button>
          </div>
        </Card>
      ) : null}

      {playing && ask === 'need-result' && snap ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">라운드 결과</p>
          {snap.iAmFirst ? (
            <label className="mb-4 flex flex-col gap-1 text-sm">
              <span className="text-cdm-fg-muted">상대 장수</span>
              <input
                type="number"
                min={0}
                max={snap.opp.inventoryCount}
                value={oppCount}
                onChange={(e) => setOppCount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="h-10 w-32 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-2 text-cdm-fg tabular-nums"
              />
            </label>
          ) : (
            <p className="mb-3 text-sm text-cdm-fg-muted">상대(선) 장수 {pending.firstCount ?? 0}</p>
          )}
          <p className="mb-2 text-sm text-cdm-fg-muted">누가 이겼나</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {([
              ['win', '나 승'],
              ['loss', '상대 승'],
              ['draw', '무'],
            ] as const).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant={outcome === id ? 'primary' : 'secondary'}
                onClick={() => setOutcome(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          {outcome === 'win' ? (
            <label className="mb-4 flex flex-col gap-1 text-sm">
              <span className="text-cdm-fg-muted">상대(패자) 금액</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={oppAmount}
                onChange={(e) => setOppAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="h-10 w-40 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-2 text-cdm-fg tabular-nums"
              />
            </label>
          ) : null}
          {outcome === 'loss' ? (
            <p className="mb-4 text-sm text-cdm-fg-muted">승자 금액은 비공개라 넣지 않는다.</p>
          ) : null}
          {outcome === 'draw' ? (
            <p className="mb-4 text-sm text-cdm-fg-muted">
              동률이면 상대 금액 = 내 {pending.myBet ? bankSumBetAmount(pending.myBet).toLocaleString() : 0}원
            </p>
          ) : null}
          <Button type="button" onClick={commitRound}>라운드 기록</Button>
        </Card>
      ) : null}

      {history.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-cdm-fg-muted">
          {history.map((rec, i) => (
            <li key={i}>
              R{i + 1} {bankSumBetCount(rec.myBet)}장 {bankSumBetAmount(rec.myBet).toLocaleString()}원
              {' vs '}
              {rec.oppCount}장
              {rec.oppAmount != null ? ` ${rec.oppAmount.toLocaleString()}원` : ' (승자 금액 숨김)'}
              {' · '}
              {rec.outcome === 'win' ? '나 승' : rec.outcome === 'loss' ? '상대 승' : '무'}
            </li>
          ))}
        </ul>
      ) : null}

      {playing && (history.length > 0 || pending.myBet || pending.firstCount != null) ? (
        <div className="flex flex-wrap gap-2">
          {history.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={thinking}
              onClick={() => {
                setHistory((h) => h.slice(0, -1));
                resetRoundInputs();
              }}
            >
              직전 라운드 취소
            </Button>
          ) : null}
          {pending.myBet || pending.firstCount != null ? (
            <Button type="button" variant="ghost" disabled={thinking} onClick={resetRoundInputs}>
              이번 라운드 다시
            </Button>
          ) : null}
        </div>
      ) : null}

      {over && snap ? (
        <Card className="flex flex-col gap-3">
          <p className="text-lg font-semibold text-cdm-fg">
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
              setIAmFirst(null);
              setHistory([]);
              resetRoundInputs();
              setSavedId(null);
              savingRef.current = false;
            }}
          >
            새 판
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
