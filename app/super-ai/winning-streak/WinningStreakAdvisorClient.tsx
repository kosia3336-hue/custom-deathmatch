'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  CARD_TYPES,
  WS_CARD_NAMES,
  WS_TOTAL_ROUNDS,
  wsAdvisorFinished,
  wsAdvisorSnapshot,
  wsAdvisorWinnerFromResult,
  wsIsWinResult,
  wsJudgeMatch,
  wsLegalCards,
  type WSCardCount,
  type WSCardType,
  type WsAdvisorRound,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-ws-advisor-v1';

const CARD_MARK: Record<WSCardType, string> = {
  spade: '♠',
  diamond: '♦',
  heart: '♥',
  club: '♣',
  blackJoker: '흑백',
  colorJoker: '컬러',
};

type Stored = { history: WsAdvisorRound[] };

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

async function saveFinishedKifu(history: WsAdvisorRound[]): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:winningStreak:save', { history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function CountRow({ label, cards }: { label: string; cards: WSCardCount }) {
  return (
    <p className="text-sm text-cdm-fg-muted">
      <span className="font-medium text-cdm-fg">{label}</span>
      {' · '}
      {CARD_TYPES.map((ct) => `${CARD_MARK[ct]} ${cards[ct]}`).join('  ')}
    </p>
  );
}

function CardPick({
  value,
  cards,
  lastPlayed,
  onChange,
  disabled,
}: {
  value: WSCardType | null;
  cards: WSCardCount;
  lastPlayed: WSCardType | null;
  onChange: (c: WSCardType) => void;
  disabled?: boolean;
}) {
  const legal = wsLegalCards(cards, lastPlayed);
  return (
    <div className="flex flex-wrap gap-2">
      {CARD_TYPES.map((ct) => {
        const n = cards[ct];
        const allowed = legal.includes(ct);
        return (
          <Button
            key={ct}
            type="button"
            size="sm"
            variant={value === ct ? 'primary' : 'secondary'}
            disabled={disabled || n <= 0 || !allowed}
            onClick={() => onChange(ct)}
          >
            {CARD_MARK[ct]} {WS_CARD_NAMES[ct]}
            {n > 1 ? ` ×${n}` : ''}
          </Button>
        );
      })}
    </div>
  );
}

export default function WinningStreakAdvisorClient() {
  const [history, setHistory] = useState<WsAdvisorRound[]>([]);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recommended, setRecommended] = useState<WSCardType | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [myCard, setMyCard] = useState<WSCardType | null>(null);
  const [oppCard, setOppCard] = useState<WSCardType | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (stored.history.length > 0) {
      const leftover = wsAdvisorSnapshot(stored.history);
      if (wsAdvisorFinished(leftover.result)) {
        void saveFinishedKifu(stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(() => wsAdvisorSnapshot(history), [history]);
  const playing = started && snap.result.kind === 'playing';
  const over = started && wsAdvisorFinished(snap.result);
  const overWinner = over ? wsAdvisorWinnerFromResult(snap.result) : null;

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
        getSocket().emit('superAi:winningStreak:recommend', { history }, (res) => {
          clearTimeout(t);
          if (!res.success || !res.card) {
            reject(new Error(res.error ?? '수를 받지 못했습니다.'));
            return;
          }
          setRecommended(res.card);
          setMyCard(res.card);
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
      toast.error('나와 상대 카드를 모두 넣으세요.');
      return;
    }
    setHistory((h) => [...h, { myCard, oppCard }]);
    setMyCard(null);
    setOppCard(null);
    clearRec();
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">연승게임 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 카드만 받는다. 잔여 장수는 공개다. 한 라운드가 아니라
          최대 연승·총승으로 게임을 이긴다.
        </p>
      </div>

      {!started ? (
        <Card>
          <p className="mb-3 text-sm text-cdm-fg-muted">
            1라운드부터 기록한다. 컬러조커로 이번 라운드만 사면 안 된다.
          </p>
          <Button type="button" onClick={() => setStarted(true)}>
            자문 시작
          </Button>
        </Card>
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Tag>R{Math.min(snap.round, WS_TOTAL_ROUNDS)} / {WS_TOTAL_ROUNDS}</Tag>
              <span className="text-sm text-cdm-fg">
                나 최대 {snap.my.maxStreak} · {snap.my.currentStreak}연승 · {snap.my.totalWins}승
              </span>
              <span className="text-sm text-cdm-fg-muted">
                상대 최대 {snap.opp.maxStreak} · {snap.opp.currentStreak}연승 · {snap.opp.totalWins}승
              </span>
            </div>
            <CountRow label="내 잔여" cards={snap.my.remaining} />
            <CountRow label="상대 잔여" cards={snap.opp.remaining} />
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
                  {recommended ? ` (추천 ${CARD_MARK[recommended]} ${WS_CARD_NAMES[recommended]})` : ''}
                </p>
                <CardPick
                  value={myCard}
                  cards={snap.my.remaining}
                  lastPlayed={snap.my.lastPlayed}
                  onChange={setMyCard}
                  disabled={thinking}
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-cdm-fg">상대가 낸 카드</p>
                <CardPick
                  value={oppCard}
                  cards={snap.opp.remaining}
                  lastPlayed={snap.opp.lastPlayed}
                  onChange={setOppCard}
                  disabled={thinking}
                />
              </div>

              {myCard && oppCard && (
                <p className="text-sm text-cdm-fg-muted">
                  {wsJudgeMatch(myCard, oppCard).description}
                  {wsIsWinResult(wsJudgeMatch(myCard, oppCard).resultA) ? ' · 이번 라운드 나 승' : ' · 이번 라운드 나 패'}
                </p>
              )}

              <Button type="button" onClick={commitRound} disabled={thinking || !myCard || !oppCard}>
                이 라운드 기록
              </Button>
            </>
          )}

          {history.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm text-cdm-fg-muted">
              {history.map((rec, i) => {
                const j = wsJudgeMatch(rec.myCard, rec.oppCard);
                return (
                  <li key={i}>
                    R{i + 1} {CARD_MARK[rec.myCard]} vs {CARD_MARK[rec.oppCard]}
                    {wsIsWinResult(j.resultA) ? ' · 승' : ' · 패'}
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
                  setMyCard(null);
                  setOppCard(null);
                  setSavedId(null);
                  savingRef.current = false;
                  clearRec();
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
