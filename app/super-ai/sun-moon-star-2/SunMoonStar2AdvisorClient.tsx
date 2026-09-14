'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  MARK_IDS,
  MARK_LABELS,
  SMS2_INITIAL_CHIPS,
  firstMaxBet,
  secondMinBet,
  sms2AdvisorAsk,
  sms2AdvisorFinished,
  sms2AdvisorRoundLegal,
  sms2AdvisorSnapshot,
  sms2AdvisorWinnerFromResult,
  sumBet,
  sumPowder,
  zeroBet,
  zeroPowder,
  type SMS2ChipBet,
  type SMS2MarkId,
  type SMS2PowderStage,
  type SMS2PowderSubmission,
  type Sms2AdvisorPending,
  type Sms2AdvisorRound,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-sms2-advisor-v1';
const STAGES: SMS2PowderStage[] = [1, 2, 3, 4, 5];

type Stored = {
  iAmFirst: boolean | null;
  history: Sms2AdvisorRound[];
  pending: Sms2AdvisorPending;
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
  history: Sms2AdvisorRound[],
): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:sunMoonStar2:save', { iAmFirst, history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function Triple({
  value,
  maxEach,
  onChange,
  disabled,
  unit,
}: {
  value: SMS2PowderSubmission | SMS2ChipBet;
  maxEach: number;
  onChange: (v: SMS2PowderSubmission) => void;
  disabled?: boolean;
  unit: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MARK_IDS.map((m) => (
        <label key={m} className="flex flex-col gap-1 text-sm">
          <span className="text-cdm-fg-muted">{MARK_LABELS[m]}</span>
          <input
            type="number"
            min={0}
            max={maxEach}
            disabled={disabled}
            value={value[m]}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isFinite(n)) return;
              onChange({ ...value, [m]: Math.max(0, Math.min(maxEach, Math.floor(n))) });
            }}
            className="h-10 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-2 text-cdm-fg tabular-nums"
          />
          <span className="text-xs text-cdm-fg-muted">{unit}</span>
        </label>
      ))}
    </div>
  );
}

export default function SunMoonStar2AdvisorClient() {
  const [iAmFirst, setIAmFirst] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Sms2AdvisorRound[]>([]);
  const [pending, setPending] = useState<Sms2AdvisorPending>({});
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [myPowder, setMyPowder] = useState<SMS2PowderSubmission>(zeroPowder());
  const [myBet, setMyBet] = useState<SMS2ChipBet>(zeroBet());
  const [oppFirstBet, setOppFirstBet] = useState<SMS2ChipBet>(zeroBet());
  const [oppSecondBet, setOppSecondBet] = useState<SMS2ChipBet>(zeroBet());
  const [oppStageAfter, setOppStageAfter] = useState<SMS2PowderStage | null>(null);
  const [litMark, setLitMark] = useState<SMS2MarkId | null>(null);
  const [leftoverAfter, setLeftoverAfter] = useState<SMS2PowderSubmission>(zeroPowder());
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (typeof stored.iAmFirst === 'boolean' && stored.history.length > 0) {
      const leftover = sms2AdvisorSnapshot(stored.iAmFirst, stored.history);
      if (sms2AdvisorFinished(leftover.result)) {
        void saveFinishedKifu(stored.iAmFirst, stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(
    () => (typeof iAmFirst === 'boolean' ? sms2AdvisorSnapshot(iAmFirst, history) : null),
    [iAmFirst, history],
  );
  const ask = useMemo(
    () => (typeof iAmFirst === 'boolean' ? sms2AdvisorAsk(iAmFirst, history, pending) : null),
    [iAmFirst, history, pending],
  );
  const playing = snap != null && snap.result.kind === 'playing';
  const over = snap != null && sms2AdvisorFinished(snap.result);
  const overWinner = over && snap ? sms2AdvisorWinnerFromResult(snap.result) : null;

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
    setMyPowder(zeroPowder());
    setMyBet(zeroBet());
    setOppFirstBet(zeroBet());
    setOppSecondBet(zeroBet());
    setOppStageAfter(null);
    setLitMark(null);
    setLeftoverAfter(zeroPowder());
    setWinRate(null);
  }

  async function recommend(pendingArg?: Sms2AdvisorPending) {
    if (thinking || !playing || typeof iAmFirst !== 'boolean') return;
    const usePending = pendingArg ?? pending;
    const currentAsk = sms2AdvisorAsk(iAmFirst, history, usePending);
    if (currentAsk !== 'powder' && currentAsk !== 'betFirst' && currentAsk !== 'betSecond') {
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
          'superAi:sunMoonStar2:recommend',
          { iAmFirst, history, pending: usePending },
          (res) => {
            clearTimeout(t);
            if (!res.success) {
              reject(new Error(res.error ?? '수를 받지 못했습니다.'));
              return;
            }
            if (res.kind === 'powder' && res.powder) {
              setMyPowder(res.powder);
            } else if (res.kind === 'bet' && res.bet) {
              setMyBet(res.bet);
            } else {
              reject(new Error(res.error ?? '수를 받지 못했습니다.'));
              return;
            }
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

  function lockPowder() {
    if (!snap) return;
    if (sumPowder(myPowder) > snap.my.powderRemain) {
      toast.error('빛가루가 잔여보다 많습니다.');
      return;
    }
    const next = { ...pending, myPowder };
    setPending(next);
  }

  function lockStage() {
    if (oppStageAfter == null || typeof iAmFirst !== 'boolean') {
      toast.error('상대 표시등 단계를 넣으세요.');
      return;
    }
    const next = { ...pending, oppStageAfter };
    setPending(next);
    const nextAsk = sms2AdvisorAsk(iAmFirst, history, next);
    if (nextAsk === 'betFirst' || nextAsk === 'betSecond') {
      void recommend(next);
    }
  }

  function lockOppFirst() {
    const next = { ...pending, oppFirstBet };
    setPending(next);
    void recommend(next);
  }

  function lockMyBet() {
    setPending((p) => ({ ...p, myBet }));
  }

  function commitRound() {
    if (!snap || typeof iAmFirst !== 'boolean' || !pending.myPowder || pending.oppStageAfter == null || !pending.myBet || !litMark) {
      toast.error('빛가루·베팅·점등·보드 합산을 모두 넣으세요.');
      return;
    }
    const oppBet = snap.iAmFirst ? oppSecondBet : (pending.oppFirstBet ?? zeroBet());
    const rec: Sms2AdvisorRound = {
      myPowder: pending.myPowder,
      myBet: pending.myBet,
      oppBet,
      litMark,
      leftoverAfter,
      oppStageAfter: pending.oppStageAfter,
    };
    if (!sms2AdvisorRoundLegal(snap, rec)) {
      toast.error('베팅 한도나 보드 합산이 올바르지 않습니다. 점등 표식 합산은 0이어야 합니다.');
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
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">해달별2 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 빛가루와 칩만 받는다. 상대 정확 잔량과 이번 분배는 모른다.
          한 라운드가 아니라 칩으로 게임을 이긴다.
        </p>
      </div>

      {iAmFirst == null ? (
        <Card>
          <p className="mb-3 text-sm text-cdm-fg-muted">1라운드 선베팅이 나인가?</p>
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
            <span className="text-cdm-fg">칩 {snap.my.chips} vs {snap.opp.chips}</span>
            <span className="text-cdm-fg-muted">내 빛가루 {snap.my.powderRemain}g</span>
            <span className="text-cdm-fg-muted">상대 표시등 {snap.opp.powderStage}단계</span>
          </div>
          <p className="mt-2 text-sm text-cdm-fg-muted">
            보드 해 {snap.leftover.sun} · 달 {snap.leftover.moon} · 별 {snap.leftover.star}
          </p>
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

      {playing && ask === 'powder' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">빛가루</p>
          <Triple value={myPowder} maxEach={snap?.my.powderRemain ?? 100} onChange={setMyPowder} unit="g" disabled={thinking} />
          <p className="mt-2 text-sm text-cdm-fg-muted">합 {sumPowder(myPowder)}g</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void recommend()} disabled={thinking}>추천 받기</Button>
            <Button type="button" variant="secondary" onClick={lockPowder} disabled={thinking}>이 분배로 확정</Button>
          </div>
        </Card>
      ) : null}

      {playing && ask === 'need-opp-stage' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">상대 표시등 (빛가루 제출 후)</p>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={oppStageAfter === s ? 'primary' : 'secondary'}
                onClick={() => setOppStageAfter(s)}
              >
                {s}단계
              </Button>
            ))}
          </div>
          <Button type="button" className="mt-4" onClick={lockStage} disabled={oppStageAfter == null || thinking}>
            단계 넣고 베팅 추천
          </Button>
        </Card>
      ) : null}

      {playing && ask === 'need-opp-first-bet' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">상대 선 베팅 (공개)</p>
          <Triple value={oppFirstBet} maxEach={snap?.opp.chips ?? SMS2_INITIAL_CHIPS} onChange={setOppFirstBet} unit="칩" />
          <Button type="button" className="mt-4" onClick={lockOppFirst} disabled={thinking}>
            넣고 후 베팅 추천
          </Button>
        </Card>
      ) : null}

      {playing && (ask === 'betFirst' || ask === 'betSecond') ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">{ask === 'betFirst' ? '선 베팅' : '후 베팅'}</p>
          {ask === 'betFirst' && snap ? (
            <p className="mb-2 text-sm text-cdm-fg-muted">
              최대 {Math.min(snap.my.chips, firstMaxBet(snap.opp.chips))}칩
            </p>
          ) : null}
          {ask === 'betSecond' && snap && pending.oppFirstBet ? (
            <p className="mb-2 text-sm text-cdm-fg-muted">
              최소 {secondMinBet(sumBet(pending.oppFirstBet))}칩
            </p>
          ) : null}
          <Triple value={myBet} maxEach={snap?.my.chips ?? SMS2_INITIAL_CHIPS} onChange={setMyBet} unit="칩" disabled={thinking} />
          <p className="mt-2 text-sm text-cdm-fg-muted">합 {sumBet(myBet)}칩</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void recommend()} disabled={thinking}>추천 받기</Button>
            <Button type="button" variant="secondary" onClick={lockMyBet} disabled={thinking}>이 베팅으로 확정</Button>
          </div>
        </Card>
      ) : null}

      {playing && ask === 'need-result' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">라운드 결과</p>
          {snap?.iAmFirst ? (
            <div className="mb-4">
              <p className="mb-2 text-sm text-cdm-fg-muted">상대 후 베팅</p>
              <Triple value={oppSecondBet} maxEach={snap.opp.chips} onChange={setOppSecondBet} unit="칩" />
            </div>
          ) : null}
          <p className="mb-2 text-sm text-cdm-fg-muted">점등 표식</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {MARK_IDS.map((m) => (
              <Button
                key={m}
                type="button"
                size="sm"
                variant={litMark === m ? 'primary' : 'secondary'}
                onClick={() => setLitMark(m)}
              >
                {MARK_LABELS[m]}
              </Button>
            ))}
          </div>
          <p className="mb-2 text-sm text-cdm-fg-muted">점등 후 보드 합산 (점등 표식은 0)</p>
          <Triple value={leftoverAfter} maxEach={400} onChange={setLeftoverAfter} unit="g" />
          <Button type="button" className="mt-4" onClick={commitRound}>라운드 기록</Button>
        </Card>
      ) : null}

      {history.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-cdm-fg-muted">
          {history.map((rec, i) => (
            <li key={i}>
              R{i + 1} 빛가루 {sumPowder(rec.myPowder)}g · 칩 {sumBet(rec.myBet)} vs {sumBet(rec.oppBet)} · 점등 {MARK_LABELS[rec.litMark]}
            </li>
          ))}
        </ul>
      ) : null}

      {playing && (history.length > 0 || pending.myPowder) ? (
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
          {pending.myPowder ? (
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
