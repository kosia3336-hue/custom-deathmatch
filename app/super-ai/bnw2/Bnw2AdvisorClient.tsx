'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  BNW2_MAX_SCORE,
  bnw2AdvisorAsk,
  bnw2AdvisorFinished,
  bnw2AdvisorSnapshot,
  bnw2AdvisorWinnerFromResult,
  bnw2InferSpendRange,
  bnw2StageRange,
  calcBNW2Color,
  calcBNW2Stage,
  type BNW2Color,
  type Bnw2AdvisorPending,
  type Bnw2AdvisorRound,
  type Bnw2AdvisorWinner,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-bnw2-advisor-v2';

function isAdvisorRound(x: unknown): x is Bnw2AdvisorRound {
  if (!x || typeof x !== 'object') return false;
  const rec = x as Record<string, unknown>;
  return (
    typeof rec.iWasFirst === 'boolean' &&
    typeof rec.myPoints === 'number' &&
    (rec.oppColor === 'black' || rec.oppColor === 'white') &&
    typeof rec.oppStageAfter === 'number' &&
    (rec.winner === 'me' || rec.winner === 'opp' || rec.winner === 'draw')
  );
}

type Stored = {
  iAmFirst: boolean | null;
  history: Bnw2AdvisorRound[];
  pending: Bnw2AdvisorPending;
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
    const history = parsed.history.filter(isAdvisorRound);
    if (history.length !== parsed.history.length) {
      return { iAmFirst: null, history: [], pending: {} };
    }
    return {
      iAmFirst: parsed.iAmFirst,
      history,
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
  history: Bnw2AdvisorRound[],
): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:bnw2:save', { iAmFirst, history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function winnerLabel(w: Bnw2AdvisorWinner): string {
  if (w === 'me') return '승';
  if (w === 'opp') return '패';
  return '무';
}

function WinnerPick({
  value,
  onChange,
  disabled,
}: {
  value: Bnw2AdvisorWinner | null;
  onChange: (w: Bnw2AdvisorWinner) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={value === 'me' ? 'primary' : 'secondary'}
        disabled={disabled}
        onClick={() => onChange('me')}
      >
        나 승
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === 'opp' ? 'primary' : 'secondary'}
        disabled={disabled}
        onClick={() => onChange('opp')}
      >
        상대 승
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === 'draw' ? 'primary' : 'secondary'}
        disabled={disabled}
        onClick={() => onChange('draw')}
      >
        무
      </Button>
    </div>
  );
}

function ColorPick({
  value,
  onChange,
  disabled,
}: {
  value: BNW2Color | null;
  onChange: (c: BNW2Color) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={value === 'black' ? 'primary' : 'secondary'}
        disabled={disabled}
        onClick={() => onChange('black')}
      >
        흑 (0~9)
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === 'white' ? 'primary' : 'secondary'}
        disabled={disabled}
        onClick={() => onChange('white')}
      >
        백 (10+)
      </Button>
    </div>
  );
}

function PointsField({
  label,
  value,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-cdm-fg">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        step={1}
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(0, Math.min(max, Math.round(n))));
        }}
        className="h-10 w-32 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 text-cdm-fg tabular-nums"
      />
    </label>
  );
}

export default function Bnw2AdvisorClient() {
  const [iAmFirst, setIAmFirst] = useState<boolean | null>(null);
  const [history, setHistory] = useState<Bnw2AdvisorRound[]>([]);
  const [pending, setPending] = useState<Bnw2AdvisorPending>({});
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recommended, setRecommended] = useState<number | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [myPoints, setMyPoints] = useState<number | null>(null);
  const [oppColor, setOppColor] = useState<BNW2Color | null>(null);
  const [oppStageAfter, setOppStageAfter] = useState<number | null>(null);
  const [roundWinner, setRoundWinner] = useState<Bnw2AdvisorWinner | null>(null);
  const [firstColor, setFirstColor] = useState<BNW2Color | null>(null);
  const [firstStageAfter, setFirstStageAfter] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (typeof stored.iAmFirst === 'boolean' && stored.history.length > 0) {
      const leftover = bnw2AdvisorSnapshot(stored.iAmFirst, stored.history);
      if (bnw2AdvisorFinished(leftover.result)) {
        void saveFinishedKifu(stored.iAmFirst, stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(
    () => (typeof iAmFirst === 'boolean' ? bnw2AdvisorSnapshot(iAmFirst, history) : null),
    [iAmFirst, history],
  );
  const ask = useMemo(
    () => (typeof iAmFirst === 'boolean' ? bnw2AdvisorAsk(iAmFirst, history, pending) : null),
    [iAmFirst, history, pending],
  );
  const playing = snap != null && snap.result.kind === 'playing';
  const over = snap != null && bnw2AdvisorFinished(snap.result);
  const overWinner = over && snap ? bnw2AdvisorWinnerFromResult(snap.result) : null;

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
    setMyPoints(null);
    setOppColor(null);
    setOppStageAfter(null);
    setRoundWinner(null);
    setFirstColor(null);
    setFirstStageAfter(null);
    setPending({});
    clearRec();
  }

  async function recommend(pendingArg?: Bnw2AdvisorPending) {
    if (thinking || !playing || typeof iAmFirst !== 'boolean') return;
    const usePending = pendingArg ?? pending;
    const currentAsk = bnw2AdvisorAsk(iAmFirst, history, usePending);
    if (currentAsk === 'need-first-color') {
      toast.error('선플 색과 제시 후 단계를 먼저 넣으세요.');
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
          'superAi:bnw2:recommend',
          { iAmFirst, history, pending: usePending },
          (res) => {
            clearTimeout(t);
            if (!res.success || typeof res.points !== 'number') {
              reject(new Error(res.error ?? '수를 받지 못했습니다.'));
              return;
            }
            setRecommended(res.points);
            setMyPoints(res.points);
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
    if (!firstColor || firstStageAfter == null) {
      toast.error('선플 색과 제시 후 단계를 넣으세요.');
      return;
    }
    const next = { firstColor, firstStageAfter };
    setPending(next);
    void recommend(next);
  }

  function commitRound() {
    if (!snap || myPoints == null) {
      toast.error('낸 포인트를 넣으세요.');
      return;
    }
    if (myPoints > snap.my.remaining) {
      toast.error('잔여보다 큰 제시는 넣을 수 없습니다.');
      return;
    }
    let color: BNW2Color | null;
    let stageAfter: number | null;
    if (snap.iAmFirst) {
      color = oppColor;
      stageAfter = oppStageAfter;
    } else {
      color = pending.firstColor ?? null;
      stageAfter = pending.firstStageAfter ?? null;
    }
    if (!color || stageAfter == null) {
      toast.error('상대 색과 제시 후 단계를 넣으세요.');
      return;
    }
    if (stageAfter > snap.opp.stage) {
      toast.error('상대 불이 올라갈 수는 없습니다.');
      return;
    }
    if (!roundWinner) {
      toast.error('이번 라운드 승패를 넣으세요.');
      return;
    }
    setHistory((h) => [
      ...h,
      {
        iWasFirst: snap.iAmFirst,
        myPoints,
        oppColor: color,
        oppStageAfter: stageAfter,
        winner: roundWinner,
      },
    ]);
    resetRoundInputs();
  }

  const inferred =
    snap && pending.firstColor != null && pending.firstStageAfter != null
      ? bnw2InferSpendRange(snap.opp.stage, pending.firstStageAfter, pending.firstColor)
      : null;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">흑과백2 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 포인트만 받는다. 상대 숫자는 끝까지 마스킹이다. 후플은
          색과 단계만 보고, 라운드가 끝나면 색·불·승패만 넣는다. 90초 동안 기보 상대 모형과
          남은 10점을 계산한다.
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
              <Tag>{snap.iAmFirst ? '내 선플' : '내 후플'}</Tag>
              <span className="text-sm text-cdm-fg">
                나 {snap.my.score}/{BNW2_MAX_SCORE} · {snap.my.remaining}p · 단계 {snap.my.stage}
              </span>
              <span className="text-sm text-cdm-fg-muted">
                상대 {snap.opp.score}/{BNW2_MAX_SCORE} · 단계 {snap.opp.stage}
                {snap.opp.stage <= 0
                  ? ' (0)'
                  : ` (${bnw2StageRange(snap.opp.stage).lo}~${bnw2StageRange(snap.opp.stage).hi})`}
              </span>
            </div>
          </Card>

          {playing && (
            <>
              {!snap.iAmFirst && ask === 'need-first-color' && (
                <Card className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-cdm-fg">선플이 낸 색 · 불이 꺼진 뒤 단계</p>
                  <ColorPick
                    value={firstColor}
                    onChange={setFirstColor}
                    disabled={thinking}
                  />
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 11 }, (_, i) => i).map((st) => (
                      <Button
                        key={st}
                        type="button"
                        size="sm"
                        variant={firstStageAfter === st ? 'primary' : 'secondary'}
                        disabled={thinking}
                        onClick={() => setFirstStageAfter(st)}
                      >
                        {st}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-cdm-fg-muted">
                    선플 제시 전 단계는 {snap.opp.stage}. 불이 안 꺼졌으면 같은 숫자를 고른다.
                  </p>
                  <Button
                    type="button"
                    onClick={lockFirstSight}
                    disabled={thinking || !firstColor || firstStageAfter == null}
                  >
                    이 정보로 수 받기
                  </Button>
                </Card>
              )}

              {ask !== 'need-first-color' && (
                <>
                  {inferred && (
                    <p className="text-sm text-cdm-fg-muted">
                      선플 추정 {inferred.lo}~{inferred.hi}
                      {pending.firstColor === 'white' ? ' · 1~9는 진다' : ''}
                    </p>
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

                  <div className="flex flex-wrap gap-6">
                    <PointsField
                      label={recommended != null ? `낼 포인트 (추천 ${recommended})` : '낼 포인트'}
                      value={myPoints}
                      max={snap.my.remaining}
                      onChange={setMyPoints}
                      disabled={thinking}
                    />
                  </div>

                  {snap.iAmFirst ? (
                    <Card className="flex flex-col gap-3">
                      <p className="text-sm font-medium text-cdm-fg">상대가 낸 색 · 불이 꺼진 뒤 단계</p>
                      <ColorPick value={oppColor} onChange={setOppColor} disabled={thinking} />
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 11 }, (_, i) => i).map((st) => (
                          <Button
                            key={st}
                            type="button"
                            size="sm"
                            variant={oppStageAfter === st ? 'primary' : 'secondary'}
                            disabled={thinking}
                            onClick={() => setOppStageAfter(st)}
                          >
                            {st}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-cdm-fg-muted">
                        상대 제시 전 단계는 {snap.opp.stage}. 불이 안 꺼졌으면 같은 숫자를 고른다.
                        숫자는 화면에 없다.
                      </p>
                      <p className="text-sm font-medium text-cdm-fg">이번 라운드</p>
                      <WinnerPick value={roundWinner} onChange={setRoundWinner} disabled={thinking} />
                    </Card>
                  ) : (
                    <Card className="flex flex-col gap-3">
                      <p className="text-sm text-cdm-fg-muted">
                        상대 {pending.firstColor === 'black' ? '흑' : '백'}
                        {pending.firstStageAfter != null ? ` · 단계 ${pending.firstStageAfter}` : ''}
                        . 숫자는 화면에 없다.
                      </p>
                      <p className="text-sm font-medium text-cdm-fg">이번 라운드</p>
                      <WinnerPick value={roundWinner} onChange={setRoundWinner} disabled={thinking} />
                    </Card>
                  )}

                  {myPoints != null && (
                    <p className="text-sm text-cdm-fg-muted">
                      나 {calcBNW2Color(myPoints) === 'black' ? '흑' : '백'} {myPoints}
                      {' · '}단계 {calcBNW2Stage(snap.my.remaining)}→
                      {calcBNW2Stage(snap.my.remaining - myPoints)}
                      {roundWinner ? ` · ${winnerLabel(roundWinner)}` : ''}
                    </p>
                  )}

                  <Button
                    type="button"
                    onClick={commitRound}
                    disabled={
                      thinking ||
                      myPoints == null ||
                      !roundWinner ||
                      (snap.iAmFirst
                        ? !oppColor || oppStageAfter == null
                        : pending.firstColor == null || pending.firstStageAfter == null)
                    }
                  >
                    이 라운드 기록
                  </Button>
                </>
              )}
            </>
          )}

          {history.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-cdm-fg-muted">
              {history.map((rec, i) => (
                <li key={i}>
                  R{i + 1} {rec.iWasFirst ? '선' : '후'} 나 {rec.myPoints} · 상대{' '}
                  {rec.oppColor === 'black' ? '흑' : '백'} 단계 {rec.oppStageAfter} ·{' '}
                  {winnerLabel(rec.winner)}
                </li>
              ))}
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
