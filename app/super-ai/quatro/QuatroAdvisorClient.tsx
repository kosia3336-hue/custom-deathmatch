'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  QUATRO_SUITS,
  QUATRO_VP_COUNT,
  quatroAdvisorAsk,
  quatroAdvisorFinished,
  quatroAdvisorPlyLegal,
  quatroAdvisorSnapshot,
  quatroAdvisorWinnerFromResult,
  quatroCardLabel,
  quatroFullDeck,
  quatroIsQuatro,
  quatroRemainingCards,
  type QuatroAction,
  type QuatroAdvisorPly,
  type QuatroCard,
  type QuatroSuit,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-quatro-advisor-v1';

const SUIT_CLASS: Record<QuatroSuit, string> = {
  spade: 'text-blue-800',
  diamond: 'text-yellow-700',
  heart: 'text-red-700',
  club: 'text-green-800',
  black: 'text-cdm-fg',
};

type Stored = {
  iAmFirst: boolean | null;
  history: QuatroAdvisorPly[];
};

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

async function saveFinishedKifu(
  iAmFirst: boolean,
  history: QuatroAdvisorPly[],
): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:quatro:save', { iAmFirst, history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function byId(id: string): QuatroCard | undefined {
  return quatroFullDeck().find((c) => c.id === id);
}

function CardBtn({
  card,
  selected,
  disabled,
  onClick,
}: {
  card: QuatroCard;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 rounded-cdm-md border px-2 text-sm tabular-nums ${SUIT_CLASS[card.suit]} ${
        selected
          ? 'border-cdm-accent bg-cdm-bg-elev-2'
          : 'border-cdm-border bg-cdm-bg-elev-1'
      } disabled:opacity-40`}
    >
      {quatroCardLabel(card)}
    </button>
  );
}

function CardGrid({
  cards,
  selected,
  multi,
  disabled,
  onToggle,
}: {
  cards: QuatroCard[];
  selected: string[];
  multi?: boolean;
  disabled?: boolean;
  onToggle: (id: string) => void;
}) {
  const groups: Array<{ suit: QuatroSuit; cards: QuatroCard[] }> = [
    ...QUATRO_SUITS.map((suit) => ({ suit, cards: cards.filter((c) => c.suit === suit) })),
    { suit: 'black' as const, cards: cards.filter((c) => c.suit === 'black') },
  ].filter((g) => g.cards.length > 0);

  return (
    <div className="flex flex-col gap-2">
      {groups.map((g) => (
        <div key={g.suit} className="flex flex-wrap gap-1">
          {g.cards.map((c) => (
            <CardBtn
              key={c.id}
              card={c}
              disabled={disabled}
              selected={selected.includes(c.id)}
              onClick={() => {
                if (multi) onToggle(c.id);
                else onToggle(c.id);
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function plyLine(ply: QuatroAdvisorPly): string {
  if (ply.kind === 'deal') {
    return `손패 ${ply.myHand.map(quatroCardLabel).join(' ')}`;
  }
  if (ply.kind === 'mulligan') {
    const who = ply.by === 'me' ? '나' : '상대';
    if (!ply.use) return `${who} 멀리건 거부`;
    if (ply.by === 'me') return `나 멀리건 ${ply.newHand.map(quatroCardLabel).join(' ')}`;
    return '상대 멀리건';
  }
  if (ply.kind === 'open') {
    const who = ply.by === 'me' ? '나' : '상대';
    return `${who} 오픈 ${quatroCardLabel(ply.card)}`;
  }
  if (ply.kind === 'stop') return `${ply.by === 'me' ? '나' : '상대'} 스탑`;
  if (ply.by === 'me') {
    return `나 VP${ply.vpIndex + 1}에 ${quatroCardLabel(ply.gave)} → ${quatroCardLabel(ply.received)}`;
  }
  return `상대 VP${ply.vpIndex + 1}에 ${quatroCardLabel(ply.gave)}`;
}

function actionLine(action: QuatroAction): string {
  if (action.type === 'mulligan') return action.use ? '멀리건 사용' : '멀리건 거부';
  if (action.type === 'open') {
    const c = byId(action.cardId);
    return `오픈 ${c ? quatroCardLabel(c) : action.cardId}`;
  }
  if (action.type === 'stop') return '스탑';
  const g = byId(action.giveCardId);
  return `VP${action.vpIndex + 1}에 ${g ? quatroCardLabel(g) : action.giveCardId} 주기`;
}

export default function QuatroAdvisorClient() {
  const [iAmFirst, setIAmFirst] = useState<boolean | null>(null);
  const [history, setHistory] = useState<QuatroAdvisorPly[]>([]);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [suggested, setSuggested] = useState<QuatroAction | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [singleId, setSingleId] = useState<string | null>(null);
  const [vpIndex, setVpIndex] = useState(0);
  const [receivedId, setReceivedId] = useState<string | null>(null);
  const [oppUsedMulligan, setOppUsedMulligan] = useState<boolean | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (typeof stored.iAmFirst === 'boolean' && stored.history.length > 0) {
      const leftover = quatroAdvisorSnapshot(stored.iAmFirst, stored.history);
      if (quatroAdvisorFinished(leftover.result)) {
        void saveFinishedKifu(stored.iAmFirst, stored.history).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(
    () => (typeof iAmFirst === 'boolean' ? quatroAdvisorSnapshot(iAmFirst, history) : null),
    [iAmFirst, history],
  );
  const ask = useMemo(
    () => (typeof iAmFirst === 'boolean' ? quatroAdvisorAsk(iAmFirst, history) : null),
    [iAmFirst, history],
  );
  const playing = snap != null && snap.result.kind === 'playing';
  const over = snap != null && quatroAdvisorFinished(snap.result);
  const overWinner = over && snap ? quatroAdvisorWinnerFromResult(snap.result) : null;

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

  useEffect(() => {
    setSuggested(null);
    setWinRate(null);
    setPicked([]);
    setSingleId(null);
    setReceivedId(null);
    setOppUsedMulligan(null);
    setVpIndex(0);
  }, [ask, history.length]);

  function resetInputs() {
    setSuggested(null);
    setWinRate(null);
    setPicked([]);
    setSingleId(null);
    setReceivedId(null);
    setOppUsedMulligan(null);
    setVpIndex(0);
  }

  function pushPly(ply: QuatroAdvisorPly) {
    if (typeof iAmFirst !== 'boolean') return;
    if (!quatroAdvisorPlyLegal(iAmFirst, history, ply)) {
      toast.error('그 수는 넣을 수 없습니다. 공개된 카드가 겹치는지 확인하세요.');
      return;
    }
    setHistory((h) => [...h, ply]);
    resetInputs();
  }

  function toggleMulti(id: string, max = 4) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  }

  async function recommend() {
    if (thinking || !playing || typeof iAmFirst !== 'boolean') return;
    if (ask !== 'mulligan' && ask !== 'open' && ask !== 'exchange') {
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
          'superAi:quatro:recommend',
          { iAmFirst, history },
          (res) => {
            clearTimeout(t);
            if (!res.success || !res.action) {
              reject(new Error(res.error ?? '수를 받지 못했습니다.'));
              return;
            }
            setSuggested(res.action);
            setWinRate(typeof res.winRate === 'number' ? res.winRate : null);
            if (res.action.type === 'open') setSingleId(res.action.cardId);
            if (res.action.type === 'exchange') {
              setVpIndex(res.action.vpIndex);
              setSingleId(res.action.giveCardId);
            }
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

  function commitMulligan(use: boolean) {
    if (use) {
      const cards = picked.map(byId).filter((c): c is QuatroCard => !!c);
      if (cards.length !== 4) {
        toast.error('멀리건이면 새 손 4장을 고르세요.');
        return;
      }
      pushPly({ kind: 'mulligan', by: 'me', use: true, newHand: cards });
      return;
    }
    pushPly({ kind: 'mulligan', by: 'me', use: false });
  }

  function commitOpen() {
    if (!snap) return;
    const id = singleId ?? (suggested?.type === 'open' ? suggested.cardId : null);
    const card = id ? snap.my.hand.find((c) => c.id === id) : undefined;
    if (!card) {
      toast.error('오픈할 카드를 고르세요.');
      return;
    }
    pushPly({ kind: 'open', by: 'me', card });
  }

  function commitMyExchange() {
    if (!snap) return;
    const giveId = singleId ?? (suggested?.type === 'exchange' ? suggested.giveCardId : null);
    const give = giveId ? snap.my.hand.find((c) => c.id === giveId) : undefined;
    const recv = receivedId ? byId(receivedId) : undefined;
    if (!give || !recv) {
      toast.error('줄 카드와 받은 카드를 넣으세요.');
      return;
    }
    pushPly({
      kind: 'exchange',
      by: 'me',
      vpIndex,
      gave: give,
      received: recv,
    });
  }

  if (!ready) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const remain = snap ? quatroRemainingCards(snap) : quatroFullDeck();
  const redrawPool = snap
    ? quatroFullDeck().filter((c) => !snap.my.seenIds.includes(c.id))
    : quatroFullDeck();
  const myClosed = snap
    ? snap.my.hand.filter((c) => !snap.my.openIds.includes(c.id))
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">콰트로 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 멀리건·오픈·교환만 받는다. 상대 미오픈과 가상 플레이어 숨은 패는 모른다.
          한 수가 아니라 콰트로·합계로 이긴다.
        </p>
      </div>

      {iAmFirst == null ? (
        <Card>
          <p className="mb-3 text-sm text-cdm-fg-muted">1라운드 선(멀리건·교환 선)이 나인가?</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => setIAmFirst(true)}>내가 선</Button>
            <Button type="button" variant="secondary" onClick={() => setIAmFirst(false)}>상대가 선</Button>
          </div>
        </Card>
      ) : null}

      {snap ? (
        <Card>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Tag>{snap.phase === 'deal' ? '손패' : snap.phase}</Tag>
            {snap.round > 0 ? <Tag>{`R${snap.round}`}</Tag> : null}
            <Tag>{snap.iAmFirst ? '이번 선' : '이번 후'}</Tag>
            {snap.my.hand.length > 0 ? (
              <span className="text-cdm-fg">
                내 손 {snap.my.hand.map(quatroCardLabel).join(' ')}
                {quatroIsQuatro(snap.my.hand) ? ' · 콰트로' : ''}
              </span>
            ) : null}
            {snap.opp.openCards.length > 0 ? (
              <span className="text-cdm-fg-muted">
                상대 오픈 {snap.opp.openCards.map(quatroCardLabel).join(' ')}
              </span>
            ) : null}
          </div>
          {snap.vps.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-cdm-fg-muted sm:grid-cols-3">
              {snap.vps.map((vp) => (
                <li key={vp.index} className="rounded-cdm-md border border-cdm-border px-2 py-1">
                  VP{vp.index + 1} 숨은 {vp.hiddenCount}
                  {vp.receivedOpen.length > 0 ? ` · ${vp.receivedOpen.map(quatroCardLabel).join(' ')}` : ''}
                  {vp.usedByMe ? ' · 나' : ''}
                  {vp.usedByOpp ? ' · 상대' : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {thinking ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-cdm-accent">
              <Spinner size={16} /> 생각 중 {elapsed}초
            </p>
          ) : null}
          {winRate != null ? (
            <p className="mt-2 text-sm text-cdm-fg">게임 승률 추정 {(winRate * 100).toFixed(0)}%</p>
          ) : null}
          {suggested ? (
            <p className="mt-2 text-sm text-cdm-fg">추천: {actionLine(suggested)}</p>
          ) : null}
        </Card>
      ) : null}

      {playing && ask === 'deal' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">내 손 4장</p>
          <CardGrid cards={quatroFullDeck()} selected={picked} multi disabled={thinking} onToggle={(id) => toggleMulti(id)} />
          <Button
            type="button"
            className="mt-4"
            disabled={picked.length !== 4}
            onClick={() => {
              const cards = picked.map(byId).filter((c): c is QuatroCard => !!c);
              pushPly({ kind: 'deal', myHand: cards });
            }}
          >
            손패 확정
          </Button>
        </Card>
      ) : null}

      {playing && ask === 'mulligan' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">멀리건</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void recommend()} disabled={thinking}>추천 받기</Button>
            <Button type="button" variant="secondary" onClick={() => commitMulligan(false)} disabled={thinking}>거부</Button>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm text-cdm-fg-muted">새 손 4장 (이전에 든 카드 제외) — 사용하려면 고른다</p>
            <CardGrid cards={redrawPool} selected={picked} multi disabled={thinking} onToggle={(id) => toggleMulti(id)} />
            <Button type="button" className="mt-4" disabled={picked.length !== 4 || thinking} onClick={() => commitMulligan(true)}>
              새 손으로 확정
            </Button>
          </div>
        </Card>
      ) : null}

      {playing && ask === 'need-opp-mulligan' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">상대 멀리건 (사용 여부만)</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={oppUsedMulligan === true ? 'primary' : 'secondary'} onClick={() => setOppUsedMulligan(true)}>사용</Button>
            <Button type="button" size="sm" variant={oppUsedMulligan === false ? 'primary' : 'secondary'} onClick={() => setOppUsedMulligan(false)}>거부</Button>
          </div>
          <Button
            type="button"
            disabled={oppUsedMulligan == null}
            onClick={() => {
              if (oppUsedMulligan) pushPly({ kind: 'mulligan', by: 'opp', use: true });
              else pushPly({ kind: 'mulligan', by: 'opp', use: false });
            }}
          >
            기록
          </Button>
        </Card>
      ) : null}

      {playing && ask === 'open' && snap ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">오픈할 카드</p>
          <CardGrid
            cards={myClosed}
            selected={singleId ? [singleId] : []}
            disabled={thinking}
            onToggle={(id) => setSingleId(id)}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void recommend()} disabled={thinking}>추천 받기</Button>
            <Button type="button" variant="secondary" disabled={!singleId || thinking} onClick={commitOpen}>
              이 카드로 오픈
            </Button>
          </div>
        </Card>
      ) : null}

      {playing && ask === 'need-opp-open' ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">상대가 오픈한 카드</p>
          <CardGrid
            cards={remain}
            selected={singleId ? [singleId] : []}
            onToggle={(id) => setSingleId(id)}
          />
          <Button
            type="button"
            className="mt-4"
            disabled={!singleId}
            onClick={() => {
              const card = singleId ? byId(singleId) : undefined;
              if (!card) return;
              pushPly({ kind: 'open', by: 'opp', card });
            }}
          >
            기록
          </Button>
        </Card>
      ) : null}

      {playing && ask === 'exchange' && snap ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">
            교환 / 스탑{snap.mustExchangeRemaining > 0 ? ` · 남은 필수 ${snap.mustExchangeRemaining}` : ''}
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void recommend()} disabled={thinking}>추천 받기</Button>
            {snap.round < 3 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={thinking}
                onClick={() => {
                  setSuggested({ type: 'stop' });
                  pushPly({ kind: 'stop', by: 'me' });
                }}
              >
                스탑
              </Button>
            ) : null}
          </div>
          {suggested?.type === 'stop' ? (
            <Button type="button" onClick={() => pushPly({ kind: 'stop', by: 'me' })} disabled={thinking}>스탑 확정</Button>
          ) : null}
          <p className="mb-2 mt-4 text-sm text-cdm-fg-muted">줄 카드 (닫힌 패)</p>
          <CardGrid
            cards={myClosed}
            selected={singleId ? [singleId] : []}
            disabled={thinking}
            onToggle={(id) => setSingleId(id)}
          />
          <p className="mb-2 mt-4 text-sm text-cdm-fg-muted">가상 플레이어</p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: QUATRO_VP_COUNT }, (_, i) => (
              <Button
                key={i}
                type="button"
                size="sm"
                variant={vpIndex === i ? 'primary' : 'secondary'}
                disabled={snap.vps[i]?.usedByMe || thinking}
                onClick={() => setVpIndex(i)}
              >
                VP{i + 1}
              </Button>
            ))}
          </div>
          <p className="mb-2 mt-4 text-sm text-cdm-fg-muted">받은 카드 (공개된 뒤에 넣기)</p>
          <CardGrid
            cards={remain}
            selected={receivedId ? [receivedId] : []}
            disabled={thinking}
            onToggle={(id) => setReceivedId(id)}
          />
          <Button
            type="button"
            className="mt-4"
            disabled={!singleId || !receivedId || thinking}
            onClick={commitMyExchange}
          >
            교환 확정
          </Button>
        </Card>
      ) : null}

      {playing && ask === 'need-opp-exchange' && snap ? (
        <Card>
          <p className="mb-3 text-sm font-medium text-cdm-fg">상대 교환 (받은 카드는 모름)</p>
          {snap.round < 3 ? (
            <Button
              type="button"
              variant="secondary"
              className="mb-4"
              onClick={() => pushPly({ kind: 'stop', by: 'opp' })}
            >
              상대 스탑
            </Button>
          ) : null}
          <p className="mb-2 text-sm text-cdm-fg-muted">상대가 준 카드</p>
          <CardGrid
            cards={remain}
            selected={singleId ? [singleId] : []}
            onToggle={(id) => setSingleId(id)}
          />
          <p className="mb-2 mt-4 text-sm text-cdm-fg-muted">가상 플레이어</p>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: QUATRO_VP_COUNT }, (_, i) => (
              <Button
                key={i}
                type="button"
                size="sm"
                variant={vpIndex === i ? 'primary' : 'secondary'}
                disabled={snap.vps[i]?.usedByOpp}
                onClick={() => setVpIndex(i)}
              >
                VP{i + 1}
              </Button>
            ))}
          </div>
          <Button
            type="button"
            className="mt-4"
            disabled={!singleId}
            onClick={() => {
              const gave = singleId ? byId(singleId) : undefined;
              if (!gave) return;
              pushPly({ kind: 'exchange', by: 'opp', vpIndex, gave });
            }}
          >
            기록
          </Button>
        </Card>
      ) : null}

      {history.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-cdm-fg-muted">
          {history.map((ply, i) => (
            <li key={i}>{plyLine(ply)}</li>
          ))}
        </ul>
      ) : null}

      {playing && history.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          disabled={thinking}
          onClick={() => {
            setHistory((h) => h.slice(0, -1));
            resetInputs();
          }}
        >
          직전 수 취소
        </Button>
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
              resetInputs();
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
