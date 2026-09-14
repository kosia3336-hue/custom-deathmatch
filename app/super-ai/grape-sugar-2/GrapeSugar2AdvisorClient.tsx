'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  GS2_CARD_IDS,
  GS2_CARD_LABELS,
  GS2_TOTAL_ROUNDS,
  gs2AdvisorFinished,
  gs2AdvisorSnapshot,
  gs2AdvisorWinnerFromResult,
  gs2DiceEffective,
  type GS2CardId,
  type GS2DiceFace,
  type Gs2AdvisorRound,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-gs2-advisor-v1';
const DICE_FACES: GS2DiceFace[] = [1, 2, 3, 4, 5, 6];

type Stored = { history: Gs2AdvisorRound[] };

function loadStored(): Stored {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { history: [] };
    const parsed = JSON.parse(raw) as Stored;
    if (!Array.isArray(parsed.history)) return { history: [] };
    return { history: parsed.history };
  } catch {
    return { history: [] };
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

async function saveFinishedKifu(history: Gs2AdvisorRound[]): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:grapeSugar2:save', { history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function CardPick({
  value,
  hand,
  onChange,
  disabled,
}: {
  value: GS2CardId | null;
  hand: GS2CardId[];
  onChange: (c: GS2CardId) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {GS2_CARD_IDS.map((id) => {
        const has = hand.includes(id);
        return (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={value === id ? 'primary' : 'secondary'}
            disabled={disabled || !has}
            onClick={() => onChange(id)}
          >
            {GS2_CARD_LABELS[id]}
          </Button>
        );
      })}
    </div>
  );
}

function SugarField({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.max(0, Math.min(max, Math.floor(n))));
        }}
        className="h-9 w-24 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-2 text-sm text-cdm-fg tabular-nums"
      />
      <span className="text-sm text-cdm-fg-muted">/ {max}</span>
    </div>
  );
}

function DicePick({
  value,
  onChange,
  disabled,
}: {
  value: GS2DiceFace | null;
  onChange: (n: GS2DiceFace) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DICE_FACES.map((n) => (
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

export default function GrapeSugar2AdvisorClient() {
  const [history, setHistory] = useState<Gs2AdvisorRound[]>([]);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recommended, setRecommended] = useState<{ card: GS2CardId; sugar: number } | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [myCard, setMyCard] = useState<GS2CardId | null>(null);
  const [mySugar, setMySugar] = useState(1);
  const [oppCard, setOppCard] = useState<GS2CardId | null>(null);
  const [oppSugar, setOppSugar] = useState(1);
  const [myDice, setMyDice] = useState<GS2DiceFace | null>(null);
  const [oppDice, setOppDice] = useState<GS2DiceFace | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (stored.history.length > 0) {
      const leftover = gs2AdvisorSnapshot(stored.history);
      if (gs2AdvisorFinished(leftover.result)) {
        void saveFinishedKifu(stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(() => gs2AdvisorSnapshot(history), [history]);
  const playing = started && snap.result.kind === 'playing';
  const over = started && gs2AdvisorFinished(snap.result);
  const overWinner = over ? gs2AdvisorWinnerFromResult(snap.result) : null;
  const needMyDice = myCard != null && oppCard != null && gs2DiceEffective(myCard, oppCard, 'me');
  const needOppDice = myCard != null && oppCard != null && gs2DiceEffective(myCard, oppCard, 'opp');

  useEffect(() => {
    if (!ready) return;
    if (over && !savedId) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ history }));
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  }, [history, ready, over, savedId]);

  useEffect(() => {
    if (!ready || !over || !overWinner || savingRef.current || savedId) return;
    if (history.length === 0) return;
    savingRef.current = true;
    void saveFinishedKifu(history)
      .then((id) => {
        sessionStorage.removeItem(STORAGE_KEY);
        setSavedId(id);
      })
      .catch((err) => {
        savingRef.current = false;
        toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
      });
  }, [ready, over, overWinner, history, savedId]);

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
    setMyCard(null);
    setOppCard(null);
    setMySugar(1);
    setOppSugar(1);
    setMyDice(null);
    setOppDice(null);
    clearRec();
  }

  async function recommend() {
    if (thinking || !playing) return;
    setThinking(true);
    clearRec();
    try {
      await ensureAdvisorSocket();
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(new Error('계산이 너무 오래 걸립니다. 소켓 서버를 확인하세요.'));
        }, 100_000);
        getSocket().emit('superAi:grapeSugar2:recommend', { history }, (res) => {
          clearTimeout(t);
          if (!res.success || !res.card || typeof res.sugar !== 'number') {
            reject(new Error(res.error ?? '수를 받지 못했습니다.'));
            return;
          }
          setRecommended({ card: res.card, sugar: res.sugar });
          setMyCard(res.card);
          setMySugar(Math.max(0, Math.min(snap.my.sugarRemain, res.sugar)));
          setWinRate(typeof res.winRate === 'number' ? res.winRate : null);
          resolve();
        });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '수를 받지 못했습니다.');
    } finally {
      setThinking(false);
    }
  }

  function commitRound() {
    if (!myCard || !oppCard) {
      toast.error('나와 상대 카드·설탕을 모두 넣으세요.');
      return;
    }
    if (mySugar > snap.my.sugarRemain || oppSugar > snap.opp.sugarRemain) {
      toast.error('설탕이 잔여보다 많습니다.');
      return;
    }
    if (needMyDice && myDice == null) {
      toast.error('내 주사위 눈을 넣으세요.');
      return;
    }
    if (needOppDice && oppDice == null) {
      toast.error('상대 주사위 눈을 넣으세요.');
      return;
    }
    const rec: Gs2AdvisorRound = {
      myCard,
      mySugar,
      oppCard,
      oppSugar,
    };
    if (needMyDice && myDice != null) rec.myDice = myDice;
    if (needOppDice && oppDice != null) rec.oppDice = oppDice;
    setHistory((h) => [...h, rec]);
    resetRoundInputs();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">포도설탕2 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 카드와 설탕만 받는다. 잔여 카드는 공개다. 이번 제출은 모른다.
          한 라운드가 아니라 게임을 이긴다.
        </p>
      </div>

      {!started ? (
        <Card>
          <p className="mb-3 text-sm text-cdm-fg-muted">
            1라운드부터 기록한다. 초반에 설탕을 한꺼번에 쓰지 않는다.
          </p>
          <Button type="button" onClick={() => setStarted(true)}>
            자문 시작
          </Button>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>
                R{Math.min(snap.round, snap.maxRound)} / {snap.maxRound}
                {snap.maxRound > GS2_TOTAL_ROUNDS ? ' 연장' : ''}
              </Tag>
              <span className="text-sm text-cdm-fg">
                나 {snap.my.score}점 · 설탕 {snap.my.sugarRemain}
              </span>
              <span className="text-sm text-cdm-fg-muted">
                상대 {snap.opp.score}점 · 설탕 {snap.opp.sugarRemain}
              </span>
            </div>
            <p className="text-sm text-cdm-fg-muted">
              <span className="font-medium text-cdm-fg">내 잔여</span>
              {' · '}
              {snap.my.hand.map((c) => GS2_CARD_LABELS[c]).join(', ') || '없음'}
            </p>
            <p className="text-sm text-cdm-fg-muted">
              <span className="font-medium text-cdm-fg">상대 잔여</span>
              {' · '}
              {snap.opp.hand.map((c) => GS2_CARD_LABELS[c]).join(', ') || '없음'}
            </p>
          </Card>

          {playing && (
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
                {winRate != null && (
                  <span className="text-sm text-cdm-fg-muted">
                    게임 승률 {(winRate * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-cdm-fg">
                  낼 카드
                  {recommended
                    ? ` (추천 ${GS2_CARD_LABELS[recommended.card]} ${recommended.sugar})`
                    : ''}
                </p>
                <CardPick
                  value={myCard}
                  hand={snap.my.hand}
                  onChange={setMyCard}
                  disabled={thinking}
                />
                <p className="mb-2 mt-3 text-sm font-medium text-cdm-fg">낼 설탕</p>
                <SugarField
                  value={mySugar}
                  max={snap.my.sugarRemain}
                  onChange={setMySugar}
                  disabled={thinking}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-cdm-fg">상대가 낸 카드</p>
                <CardPick
                  value={oppCard}
                  hand={snap.opp.hand}
                  onChange={setOppCard}
                  disabled={thinking}
                />
                <p className="mb-2 mt-3 text-sm font-medium text-cdm-fg">상대가 낸 설탕</p>
                <SugarField
                  value={oppSugar}
                  max={snap.opp.sugarRemain}
                  onChange={setOppSugar}
                  disabled={thinking}
                />
              </div>

              {needMyDice && (
                <div>
                  <p className="mb-2 text-sm font-medium text-cdm-fg">내 주사위 눈</p>
                  <DicePick value={myDice} onChange={setMyDice} disabled={thinking} />
                </div>
              )}
              {needOppDice && (
                <div>
                  <p className="mb-2 text-sm font-medium text-cdm-fg">상대 주사위 눈</p>
                  <DicePick value={oppDice} onChange={setOppDice} disabled={thinking} />
                </div>
              )}

              <Button
                type="button"
                onClick={commitRound}
                disabled={thinking || !myCard || !oppCard}
              >
                이 라운드 기록
              </Button>
            </>
          )}

          {history.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-cdm-fg-muted">
              {history.map((rec, i) => (
                <li key={i}>
                  R{i + 1} {GS2_CARD_LABELS[rec.myCard]} {rec.mySugar}
                  {' vs '}
                  {GS2_CARD_LABELS[rec.oppCard]} {rec.oppSugar}
                  {rec.myDice != null ? ` · 나 주사위 ${rec.myDice}` : ''}
                  {rec.oppDice != null ? ` · 상대 주사위 ${rec.oppDice}` : ''}
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
                  resetRoundInputs();
                  setSavedId(null);
                  savingRef.current = false;
                  setStarted(true);
                }}
              >
                새 판
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
