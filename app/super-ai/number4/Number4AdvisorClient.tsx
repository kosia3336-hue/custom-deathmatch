'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  NF4_REWARDS,
  TILES_PER_ROUND,
  nf4AdvisorFinished,
  nf4AdvisorSnapshot,
  nf4AdvisorWinnerFromResult,
  nf4ScoreDelta,
  type NF4Number,
  type Nf4AdvisorRound,
  type Nf4AdvisorWinner,
} from '@/shared/types/number4';

const STORAGE_KEY = 'cdm-nf4-advisor-v2';

const NUMBER_COPY: { number: NF4Number; condition: string }[] = [
  { number: 0, condition: '양측 흑색 합 ≥ 11' },
  { number: 1, condition: '내 백색 ≥ 상대 백색' },
  { number: 2, condition: '내 곱 > 상대 곱' },
  { number: 3, condition: '내 백색 ≥ 상대 흑+2' },
  { number: 4, condition: '내 백색 ≥ 상대 흑×2' },
];

type Rec = { white: number; black: number; number: NF4Number };

type Stored = {
  history: Nf4AdvisorRound[];
  winner?: Nf4AdvisorWinner | null;
};

function loadStored(): Stored {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { history: [] };
    const parsed = JSON.parse(raw) as Stored;
    if (!Array.isArray(parsed.history)) return { history: [] };
    return {
      history: parsed.history,
      winner: parsed.winner === 'me' || parsed.winner === 'opp' ? parsed.winner : null,
    };
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

async function saveFinishedKifu(
  history: Nf4AdvisorRound[],
  winner: Nf4AdvisorWinner,
): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:number4:save', { history, winner }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function NumberPick({
  value,
  onChange,
  disabled,
}: {
  value: NF4Number | null;
  onChange: (n: NF4Number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {([0, 1, 2, 3, 4] as NF4Number[]).map((n) => (
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

function WhitePick({
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  value: number | null;
  min: number;
  max: number;
  onChange: (w: number) => void;
  disabled?: boolean;
}) {
  const opts: number[] = [];
  for (let w = min; w <= max; w++) opts.push(w);
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((w) => (
        <Button
          key={w}
          type="button"
          size="sm"
          variant={value === w ? 'primary' : 'secondary'}
          disabled={disabled}
          onClick={() => onChange(w)}
        >
          백 {w}
        </Button>
      ))}
    </div>
  );
}

function OutcomePick({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null;
  onChange: (ok: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={value === true ? 'primary' : 'secondary'}
        disabled={disabled}
        onClick={() => onChange(true)}
      >
        성공
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === false ? 'primary' : 'secondary'}
        disabled={disabled}
        onClick={() => onChange(false)}
      >
        실패
      </Button>
    </div>
  );
}

export default function Number4AdvisorClient() {
  const [history, setHistory] = useState<Nf4AdvisorRound[]>([]);
  const [winner, setWinner] = useState<Nf4AdvisorWinner | null>(null);
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recommended, setRecommended] = useState<Rec | null>(null);
  const [worlds, setWorlds] = useState<number | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [myWhite, setMyWhite] = useState<number | null>(null);
  const [myNumber, setMyNumber] = useState<NF4Number | null>(null);
  const [oppNumber, setOppNumber] = useState<NF4Number | null>(null);
  const [mySuccess, setMySuccess] = useState<boolean | null>(null);
  const [oppSuccess, setOppSuccess] = useState<boolean | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    const leftoverSnap = nf4AdvisorSnapshot(stored.history);
    if (nf4AdvisorFinished(leftoverSnap.result, stored.winner ?? null)) {
      const w = nf4AdvisorWinnerFromResult(leftoverSnap.result, stored.winner ?? null);
      if (w && stored.history.length > 0) {
        void saveFinishedKifu(stored.history, w).catch((err) => {
          toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        });
      }
    }
    setReady(true);
  }, []);

  const snap = useMemo(() => nf4AdvisorSnapshot(history), [history]);
  const playing = snap.result.kind === 'playing';
  const askWinner = snap.result.kind === 'ask-winner' && !winner;
  const over = nf4AdvisorFinished(snap.result, winner);
  const overWinner = over ? nf4AdvisorWinnerFromResult(snap.result, winner) : null;

  useEffect(() => {
    if (!ready) return;
    if (over && !savedId) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ history, winner }));
      return;
    }
    sessionStorage.removeItem(STORAGE_KEY);
  }, [history, winner, ready, over, savedId]);

  useEffect(() => {
    if (!ready || !over || !overWinner || savingRef.current || savedId) return;
    savingRef.current = true;
    void saveFinishedKifu(history, overWinner)
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

  const minWhite = Math.max(0, TILES_PER_ROUND - snap.myBlackLeft);
  const maxWhite = Math.min(TILES_PER_ROUND, snap.myWhiteLeft);
  const myBlack = myWhite == null ? null : TILES_PER_ROUND - myWhite;

  async function recommend() {
    if (thinking || !playing) return;
    setThinking(true);
    setRecommended(null);
    setWorlds(null);
    setWinRate(null);
    try {
      await ensureAdvisorSocket();

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(new Error('계산이 너무 오래 걸립니다. 소켓 서버를 확인하세요.'));
        }, 100_000);
        getSocket().emit('superAi:number4:recommend', { history }, (res) => {
          clearTimeout(t);
          if (!res.success || res.number == null || res.white == null || res.black == null) {
            reject(new Error(res.error ?? '수를 고르지 못했습니다.'));
            return;
          }
          setRecommended({ white: res.white, black: res.black, number: res.number });
          setMyWhite(res.white);
          setMyNumber(res.number);
          setWorlds(res.worlds ?? null);
          setWinRate(res.winRate ?? null);
          resolve();
        });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '수를 고르지 못했습니다.');
    } finally {
      setThinking(false);
    }
  }

  function recordRound() {
    if (!playing) return;
    if (
      myWhite == null ||
      myBlack == null ||
      myNumber == null ||
      oppNumber == null ||
      mySuccess == null ||
      oppSuccess == null
    ) {
      toast.error('내가 낸 타일·넘버, 상대 넘버, 성공·실패를 모두 고르세요.');
      return;
    }
    setHistory((prev) => [
      ...prev,
      { myWhite, myBlack, myNumber, oppNumber, mySuccess, oppSuccess },
    ]);
    setRecommended(null);
    setWorlds(null);
    setWinRate(null);
    setMyWhite(null);
    setMyNumber(null);
    setOppNumber(null);
    setMySuccess(null);
    setOppSuccess(null);
  }

  function clearRec() {
    setRecommended(null);
    setWorlds(null);
    setWinRate(null);
  }

  function undo() {
    if (over) return;
    setHistory((prev) => prev.slice(0, -1));
    setWinner(null);
    clearRec();
    setMyWhite(null);
    setMyNumber(null);
  }

  async function reset() {
    if (over && overWinner && !savedId && history.length > 0) {
      try {
        savingRef.current = true;
        await saveFinishedKifu(history, overWinner);
      } catch (err) {
        savingRef.current = false;
        toast.error(err instanceof Error ? err.message : '기보를 저장하지 못했습니다.');
        return;
      }
    }
    sessionStorage.removeItem(STORAGE_KEY);
    setHistory([]);
    setWinner(null);
    setSavedId(null);
    savingRef.current = false;
    clearRec();
    setMyWhite(null);
    setMyNumber(null);
    setOppNumber(null);
    setMySuccess(null);
    setOppSuccess(null);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-xl font-bold text-cdm-fg">넘버4 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판의 상대가 아니다. 백·흑·넘버를 알려 주면, 그걸 내고 성공·실패를 계산해 넣는다.
          상대 타일은 이쪽도 모른다. 승자가 그다음에 뭘 냈는지와, 그 수에 대한 카운터로 고른다.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{playing ? `라운드 ${snap.round}` : '종료'}</Tag>
          <span className="text-sm text-cdm-fg">
            나 {snap.myScore}점 · 상대 {snap.oppScore}점
          </span>
          <span className="text-xs text-cdm-fg-muted">
            넘버 합 {snap.myNumberSum} vs {snap.oppNumberSum}
          </span>
          {snap.tilesKnown && (
            <span className="text-xs text-cdm-fg-muted">
              남은 타일 백 {snap.myWhiteLeft} · 흑 {snap.myBlackLeft}
            </span>
          )}
        </div>
        {playing && (
          <Button
            type="button"
            loading={thinking}
            disabled={thinking}
            onClick={() => void recommend()}
          >
            {thinking ? '수 고르는 중' : '수 받기'}
          </Button>
        )}
        {thinking && (
          <div className="flex items-center gap-3 text-sm text-cdm-fg-muted">
            <Spinner size={16} label="계산 중" />
            <span>{elapsed}초 / 최대 90초. 상대 타일은 보지 않는다.</span>
          </div>
        )}
        {recommended != null && playing && !thinking && (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-bold text-cdm-fg">
              백 {recommended.white} · 흑 {recommended.black} · 넘버 {recommended.number}
            </p>
            <p className="text-sm text-cdm-fg-muted">
              {NUMBER_COPY[recommended.number]?.condition} · 성공 시 +
              {NF4_REWARDS[recommended.number]}
              {worlds != null ? ` · 상대 타일 세계 ${worlds}개` : ''}
              {winRate != null ? ` · 추정 승률 ${Math.round(winRate * 100)}%` : ''}
            </p>
          </div>
        )}
      </Card>

      {playing && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-cdm-fg">라운드 결과</h2>
          <p className="text-sm text-cdm-fg-muted">
            받은 타일과 넘버를 실제 판에 낸 뒤, 공개된 성공·실패와 상대 넘버만 넣는다.
          </p>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-cdm-fg">
              내가 낸 타일
              {myBlack != null ? ` (흑 ${myBlack})` : ''}
            </span>
            <WhitePick
              value={myWhite}
              min={minWhite}
              max={maxWhite}
              onChange={setMyWhite}
              disabled={thinking}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-cdm-fg">내가 낸 넘버</span>
            <NumberPick value={myNumber} onChange={setMyNumber} disabled={thinking} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-cdm-fg">상대 넘버</span>
            <NumberPick value={oppNumber} onChange={setOppNumber} disabled={thinking} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-cdm-fg">나</span>
            <OutcomePick value={mySuccess} onChange={setMySuccess} disabled={thinking} />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-cdm-fg">상대</span>
            <OutcomePick value={oppSuccess} onChange={setOppSuccess} disabled={thinking} />
          </div>
          <Button type="button" variant="secondary" disabled={thinking} onClick={recordRound}>
            결과 기록
          </Button>
        </Card>
      )}

      {askWinner && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-cdm-fg">누가 이겼나</h2>
          <p className="text-sm text-cdm-fg-muted">{snap.result.reason}</p>
          <div className="flex gap-2">
            <Button type="button" onClick={() => setWinner('me')}>
              내가 이김
            </Button>
            <Button type="button" variant="secondary" onClick={() => setWinner('opp')}>
              상대가 이김
            </Button>
          </div>
        </Card>
      )}

      {over && overWinner && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-cdm-fg">
            {overWinner === 'me' ? '승리' : '패배'}
          </h2>
          <p className="text-sm text-cdm-fg-muted">
            {snap.result.kind === 'ask-winner'
              ? '상대 백 총수는 몰라서 당신이 고른 승자.'
              : snap.result.reason}
          </p>
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
            {history.map((row, i) => (
              <li key={`${i}-${row.myNumber}-${row.oppNumber}`}>
                <Card className="text-sm text-cdm-fg">
                  R{i + 1}
                  {row.myWhite != null && row.myBlack != null
                    ? ` · 백 ${row.myWhite} 흑 ${row.myBlack}`
                    : ''}
                  {' '}
                  넘버 {row.myNumber}
                  {row.mySuccess ? ' 성공' : ' 실패'} (
                  {nf4ScoreDelta(row.myNumber, row.mySuccess) > 0 ? '+' : ''}
                  {nf4ScoreDelta(row.myNumber, row.mySuccess)}) · 상대 {row.oppNumber}
                  {row.oppSuccess ? ' 성공' : ' 실패'} (
                  {nf4ScoreDelta(row.oppNumber, row.oppSuccess) > 0 ? '+' : ''}
                  {nf4ScoreDelta(row.oppNumber, row.oppSuccess)})
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" disabled={history.length === 0 || thinking || over} onClick={undo}>
          마지막 라운드 취소
        </Button>
        <Button type="button" variant="ghost" disabled={thinking} onClick={() => void reset()}>
          새 판
        </Button>
      </div>
    </div>
  );
}
