'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button, Card, Spinner, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import {
  MBNW_TILE_COLOR,
  MBNW_TILE_SET,
  MBNW_TOTAL_ROUNDS,
  mbnwAdvisorAsk,
  mbnwAdvisorFinished,
  mbnwAdvisorSnapshot,
  mbnwAdvisorWinnerFromResult,
  type MBNWTile,
  type MBNWTileColor,
  type MbnwAdvisorPending,
  type MbnwAdvisorRound,
  type MbnwCmp,
} from '@/shared/types';

const STORAGE_KEY = 'cdm-mbnw-advisor-v1';

type Rec = { kind: 'tile'; tile: MBNWTile } | { kind: 'suspect'; suspect: boolean };

type Stored = {
  iAmFirst: boolean | null;
  history: MbnwAdvisorRound[];
  pending: MbnwAdvisorPending;
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
  history: MbnwAdvisorRound[],
): Promise<string> {
  await ensureAdvisorSocket();
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('기보 저장 시간 초과')), 12000);
    getSocket().emit('superAi:multipleBnw:save', { iAmFirst, history }, (res) => {
      clearTimeout(t);
      if (!res.success || !res.id) {
        reject(new Error(res.error ?? '기보를 저장하지 못했습니다.'));
        return;
      }
      resolve(res.id);
    });
  });
}

function TilePick({
  value,
  tiles,
  onChange,
  disabled,
}: {
  value: MBNWTile | null;
  tiles: readonly MBNWTile[];
  onChange: (t: MBNWTile) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tiles.map((t) => {
        const color = MBNW_TILE_COLOR[t];
        return (
          <Button
            key={t}
            type="button"
            size="sm"
            variant={value === t ? 'primary' : 'secondary'}
            disabled={disabled}
            onClick={() => onChange(t)}
          >
            {color === 'black' ? '■' : '□'} {t}
          </Button>
        );
      })}
    </div>
  );
}

export default function MultipleBnwAdvisorClient() {
  const [iAmFirst, setIAmFirst] = useState<boolean | null>(null);
  const [history, setHistory] = useState<MbnwAdvisorRound[]>([]);
  const [pending, setPending] = useState<MbnwAdvisorPending>({});
  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recommended, setRecommended] = useState<Rec | null>(null);
  const [winRate, setWinRate] = useState<number | null>(null);
  const [worlds, setWorlds] = useState<number | null>(null);
  const [tile, setTile] = useState<MBNWTile | null>(null);
  const [oppColor, setOppColor] = useState<MBNWTileColor | null>(null);
  const [suspect, setSuspect] = useState<boolean | null>(null);
  const [mySuccess, setMySuccess] = useState<boolean | null>(null);
  const [oppSuspect, setOppSuspect] = useState<'none' | 'success' | 'fail' | null>(null);
  const [cmp, setCmp] = useState<MbnwCmp | null>(null);
  const [firstSuspect, setFirstSuspect] = useState<'none' | 'success' | 'fail' | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    const stored = loadStored();
    sessionStorage.removeItem(STORAGE_KEY);
    if (typeof stored.iAmFirst === 'boolean') {
      const leftover = mbnwAdvisorSnapshot(stored.iAmFirst, stored.history);
      if (mbnwAdvisorFinished(leftover.result) && stored.history.length > 0) {
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
        ? mbnwAdvisorSnapshot(iAmFirst, history)
        : {
            round: 1,
            myScore: 0,
            oppScore: 0,
            mySuspectWins: 0,
            oppSuspectWins: 0,
            myTiles: [...MBNW_TILE_SET],
            iAmFirst: true,
            result: { kind: 'playing' as const },
          },
    [iAmFirst, history],
  );
  const ask =
    typeof iAmFirst === 'boolean' ? mbnwAdvisorAsk(iAmFirst, history, pending) : 'finished';
  const playing = typeof iAmFirst === 'boolean' && snap.result.kind === 'playing';
  const over = typeof iAmFirst === 'boolean' && mbnwAdvisorFinished(snap.result);
  const overWinner = over ? mbnwAdvisorWinnerFromResult(snap.result) : null;

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

  function clearRec() {
    setRecommended(null);
    setWinRate(null);
    setWorlds(null);
  }

  function resetResultInputs() {
    setMySuccess(null);
    setOppSuspect(null);
    setCmp(null);
  }

  function commitRound(rec: MbnwAdvisorRound) {
    setHistory((h) => [...h, rec]);
    setPending({});
    setTile(null);
    setOppColor(null);
    setSuspect(null);
    setFirstSuspect(null);
    resetResultInputs();
    clearRec();
  }

  function lockTile(t: MBNWTile) {
    setTile(t);
    setPending((p) => ({ ...p, myTile: t }));
    clearRec();
  }

  function lockOppColor(c: MBNWTileColor) {
    setOppColor(c);
    setPending((p) => ({ ...p, oppColor: c }));
    clearRec();
  }

  function applyFirstSuspect(v: 'none' | 'success' | 'fail') {
    setFirstSuspect(v);
    if (v === 'success') {
      const myTile = pending.myTile ?? tile;
      const color = pending.oppColor ?? oppColor;
      if (!myTile || !color || snap.iAmFirst) return;
      commitRound({
        iWasFirst: false,
        myTile,
        oppColor: color,
        mySuspected: false,
        mySuccess: null,
        oppSuspected: true,
        oppSuccess: true,
        secondSkipped: true,
        cmp: null,
      });
      return;
    }
    setPending((p) => ({ ...p, firstSuspect: v }));
    clearRec();
  }

  async function recommend() {
    if (thinking || !playing || typeof iAmFirst !== 'boolean') return;
    if (ask === 'need-opp-color') {
      toast.error('상대 타일 색을 먼저 넣으세요.');
      return;
    }
    if (ask === 'need-first-suspect') {
      toast.error('선플 의심 결과를 먼저 넣으세요.');
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
          'superAi:multipleBnw:recommend',
          { iAmFirst, history, pending },
          (res) => {
            clearTimeout(t);
            if (!res.success || !res.kind) {
              reject(new Error(res.error ?? '수를 받지 못했습니다.'));
              return;
            }
            if (res.kind === 'tile' && res.tile != null) {
              setRecommended({ kind: 'tile', tile: res.tile });
              setTile(res.tile);
            } else if (res.kind === 'suspect' && typeof res.suspect === 'boolean') {
              setRecommended({ kind: 'suspect', suspect: res.suspect });
              setSuspect(res.suspect);
            }
            setWinRate(typeof res.winRate === 'number' ? res.winRate : null);
            setWorlds(typeof res.worlds === 'number' ? res.worlds : null);
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

  function confirmTile() {
    const t = tile;
    if (!t || !snap.myTiles.includes(t)) {
      toast.error('타일을 고르세요.');
      return;
    }
    lockTile(t);
  }

  function submitRound() {
    const myTile = pending.myTile ?? tile;
    const color = pending.oppColor ?? oppColor;
    if (!myTile || !color) {
      toast.error('내 타일과 상대 색이 필요합니다.');
      return;
    }
    const iWasFirst = snap.iAmFirst;
    const iSuspected = suspect === true;

    if (iWasFirst) {
      if (iSuspected) {
        if (mySuccess == null) {
          toast.error('내 의심 성공/실패를 넣으세요.');
          return;
        }
        if (mySuccess) {
          commitRound({
            iWasFirst: true,
            myTile,
            oppColor: color,
            mySuspected: true,
            mySuccess: true,
            oppSuspected: false,
            oppSuccess: null,
            secondSkipped: true,
            cmp: null,
          });
          return;
        }
        if (oppSuspect == null) {
          toast.error('상대 의심 결과를 넣으세요.');
          return;
        }
        if (oppSuspect === 'success') {
          commitRound({
            iWasFirst: true,
            myTile,
            oppColor: color,
            mySuspected: true,
            mySuccess: false,
            oppSuspected: true,
            oppSuccess: true,
            secondSkipped: false,
            cmp: null,
          });
          return;
        }
        if (cmp == null) {
          toast.error('누가 더 큰 숫자였는지 넣으세요.');
          return;
        }
        commitRound({
          iWasFirst: true,
          myTile,
          oppColor: color,
          mySuspected: true,
          mySuccess: false,
          oppSuspected: oppSuspect === 'fail',
          oppSuccess: oppSuspect === 'fail' ? false : null,
          secondSkipped: false,
          cmp,
        });
        return;
      }
      if (oppSuspect == null) {
        toast.error('상대 의심 결과를 넣으세요.');
        return;
      }
      if (oppSuspect === 'success') {
        commitRound({
          iWasFirst: true,
          myTile,
          oppColor: color,
          mySuspected: false,
          mySuccess: null,
          oppSuspected: true,
          oppSuccess: true,
          secondSkipped: false,
          cmp: null,
        });
        return;
      }
      if (cmp == null) {
        toast.error('누가 더 큰 숫자였는지 넣으세요.');
        return;
      }
      commitRound({
        iWasFirst: true,
        myTile,
        oppColor: color,
        mySuspected: false,
        mySuccess: null,
        oppSuspected: oppSuspect === 'fail',
        oppSuccess: oppSuspect === 'fail' ? false : null,
        secondSkipped: false,
        cmp,
      });
      return;
    }

    const firstFailOrNone = pending.firstSuspect === 'fail' || pending.firstSuspect === 'none';
    if (!firstFailOrNone) {
      toast.error('선플 의심 결과를 먼저 넣으세요.');
      return;
    }
    if (iSuspected) {
      if (mySuccess == null) {
        toast.error('내 의심 성공/실패를 넣으세요.');
        return;
      }
      if (mySuccess) {
        commitRound({
          iWasFirst: false,
          myTile,
          oppColor: color,
          mySuspected: true,
          mySuccess: true,
          oppSuspected: pending.firstSuspect === 'fail',
          oppSuccess: pending.firstSuspect === 'fail' ? false : null,
          secondSkipped: false,
          cmp: null,
        });
        return;
      }
      if (cmp == null) {
        toast.error('누가 더 큰 숫자였는지 넣으세요.');
        return;
      }
      commitRound({
        iWasFirst: false,
        myTile,
        oppColor: color,
        mySuspected: true,
        mySuccess: false,
        oppSuspected: pending.firstSuspect === 'fail',
        oppSuccess: pending.firstSuspect === 'fail' ? false : null,
        secondSkipped: false,
        cmp,
      });
      return;
    }
    if (cmp == null) {
      toast.error('누가 더 큰 숫자였는지 넣으세요.');
      return;
    }
    commitRound({
      iWasFirst: false,
      myTile,
      oppColor: color,
      mySuspected: false,
      mySuccess: null,
      oppSuspected: pending.firstSuspect === 'fail',
      oppSuccess: pending.firstSuspect === 'fail' ? false : null,
      secondSkipped: false,
      cmp,
    });
  }

  const needRoundResult = ask === 'suspect' && suspect !== null;
  const needCmp =
    needRoundResult
    && (
      (snap.iAmFirst && suspect === false && oppSuspect !== 'success' && oppSuspect != null)
      || (snap.iAmFirst && suspect === true && mySuccess === false && oppSuspect !== 'success' && oppSuspect != null)
      || (!snap.iAmFirst && (suspect === false || mySuccess === false))
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/super-ai" className="text-sm text-cdm-fg-muted hover:text-cdm-fg">
          ← 슈퍼 AI
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-cdm-fg">배수 흑과 백 자문</h1>
        <p className="mt-1 text-sm text-cdm-fg-muted">
          실제 판에서 두고, 여기선 타일과 의심만 받는다. 상대 숫자는 엔진도 모른다. 색·의심·크기만 넣으면 된다.
        </p>
      </div>

      {iAmFirst === null ? (
        <Card>
          <p className="mb-3 font-medium text-cdm-fg">1라운드 선플이 나인가?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setIAmFirst(true)}>내가 선플</Button>
            <Button type="button" variant="secondary" onClick={() => setIAmFirst(false)}>상대가 선플</Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Tag>R{Math.min(snap.round, MBNW_TOTAL_ROUNDS)}/{MBNW_TOTAL_ROUNDS}</Tag>
            <Tag>{snap.iAmFirst ? '이번 선플' : '이번 후플'}</Tag>
            <span className="text-sm text-cdm-fg">나 {snap.myScore} · 상대 {snap.oppScore}</span>
            <span className="text-xs text-cdm-fg-muted">의심 {snap.mySuspectWins}:{snap.oppSuspectWins}</span>
          </div>
          <p className="mb-2 text-xs text-cdm-fg-muted">내 잔여</p>
          <div className="mb-4 flex flex-wrap gap-1">
            {snap.myTiles.map((t) => (
              <span
                key={t}
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded px-1 text-xs font-bold ${
                  MBNW_TILE_COLOR[t] === 'black'
                    ? 'bg-slate-800 text-slate-100'
                    : 'border border-gray-300 bg-white text-slate-700'
                }`}
              >
                {t}
              </span>
            ))}
          </div>

          {playing && ask === 'need-opp-color' && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-cdm-fg">상대가 공개한 색</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={oppColor === 'white' ? 'primary' : 'secondary'} onClick={() => lockOppColor('white')}>□ 백</Button>
                <Button type="button" size="sm" variant={oppColor === 'black' ? 'primary' : 'secondary'} onClick={() => lockOppColor('black')}>■ 흑</Button>
              </div>
            </div>
          )}

          {playing && ask === 'need-first-suspect' && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-cdm-fg">선플(상대) 의심</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant={firstSuspect === 'none' ? 'primary' : 'secondary'} onClick={() => applyFirstSuspect('none')}>안 함</Button>
                <Button type="button" size="sm" variant={firstSuspect === 'success' ? 'primary' : 'secondary'} onClick={() => applyFirstSuspect('success')}>성공</Button>
                <Button type="button" size="sm" variant={firstSuspect === 'fail' ? 'primary' : 'secondary'} onClick={() => applyFirstSuspect('fail')}>실패</Button>
              </div>
            </div>
          )}

          {playing && (ask === 'tile' || ask === 'suspect') && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void recommend()} disabled={thinking}>
                {thinking ? '계산 중' : '수 받기'}
              </Button>
              {thinking && (
                <span className="inline-flex items-center gap-2 text-sm text-cdm-fg-muted">
                  <Spinner size="sm" /> {elapsed}초 / 90초
                </span>
              )}
              {winRate != null && (
                <span className="text-sm text-cdm-fg-muted">승률 {(winRate * 100).toFixed(0)}%</span>
              )}
              {worlds != null && (
                <span className="text-xs text-cdm-fg-muted">세계 {worlds}</span>
              )}
            </div>
          )}

          {playing && ask === 'tile' && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-cdm-fg">
                낼 타일 {recommended?.kind === 'tile' ? `(추천 ${recommended.tile})` : ''}
              </p>
              <TilePick value={tile} tiles={snap.myTiles} onChange={setTile} disabled={thinking} />
              <div className="mt-3">
                <Button type="button" size="sm" onClick={confirmTile} disabled={thinking || tile == null}>
                  이 타일로 확정
                </Button>
              </div>
            </div>
          )}

          {playing && ask === 'suspect' && snap.iAmFirst && !pending.oppColor && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-cdm-fg">상대가 공개한 색</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={oppColor === 'white' ? 'primary' : 'secondary'} onClick={() => lockOppColor('white')}>□ 백</Button>
                <Button type="button" size="sm" variant={oppColor === 'black' ? 'primary' : 'secondary'} onClick={() => lockOppColor('black')}>■ 흑</Button>
              </div>
            </div>
          )}

          {playing && ask === 'suspect' && (
            <div className="mb-4">
              <p className="mb-2 text-sm font-medium text-cdm-fg">
                배수의심 {recommended?.kind === 'suspect' ? `(추천 ${recommended.suspect ? '걸기' : '안 함'})` : ''}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={suspect === true ? 'primary' : 'secondary'} disabled={thinking} onClick={() => { setSuspect(true); resetResultInputs(); }}>건다</Button>
                <Button type="button" size="sm" variant={suspect === false ? 'primary' : 'secondary'} disabled={thinking} onClick={() => { setSuspect(false); resetResultInputs(); }}>안 건다</Button>
              </div>
            </div>
          )}

          {playing && needRoundResult && (
            <div className="space-y-3">
              {suspect === true && (
                <div>
                  <p className="mb-2 text-sm font-medium text-cdm-fg">내 의심</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant={mySuccess === true ? 'primary' : 'secondary'} onClick={() => { setMySuccess(true); setOppSuspect(null); setCmp(null); }}>성공</Button>
                    <Button type="button" size="sm" variant={mySuccess === false ? 'primary' : 'secondary'} onClick={() => setMySuccess(false)}>실패</Button>
                  </div>
                </div>
              )}
              {snap.iAmFirst && (suspect === false || mySuccess === false) && (
                <div>
                  <p className="mb-2 text-sm font-medium text-cdm-fg">상대 의심</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={oppSuspect === 'none' ? 'primary' : 'secondary'} onClick={() => { setOppSuspect('none'); }}>안 함</Button>
                    <Button type="button" size="sm" variant={oppSuspect === 'success' ? 'primary' : 'secondary'} onClick={() => { setOppSuspect('success'); setCmp(null); }}>성공</Button>
                    <Button type="button" size="sm" variant={oppSuspect === 'fail' ? 'primary' : 'secondary'} onClick={() => setOppSuspect('fail')}>실패</Button>
                  </div>
                </div>
              )}
              {needCmp && (
                <div>
                  <p className="mb-2 text-sm font-medium text-cdm-fg">숫자 정산 (누가 더 컸나)</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant={cmp === 'me' ? 'primary' : 'secondary'} onClick={() => setCmp('me')}>내가 큼</Button>
                    <Button type="button" size="sm" variant={cmp === 'opp' ? 'primary' : 'secondary'} onClick={() => setCmp('opp')}>상대가 큼</Button>
                    <Button type="button" size="sm" variant={cmp === 'tie' ? 'primary' : 'secondary'} onClick={() => setCmp('tie')}>같음</Button>
                  </div>
                </div>
              )}
              <Button type="button" onClick={submitRound}>이 라운드 넣기</Button>
            </div>
          )}

          {over && (
            <div className="space-y-2">
              <p className="font-medium text-cdm-fg">
                {overWinner === 'me' ? '승리' : overWinner === 'opp' ? '패배' : '무승부'}
                {snap.result.kind !== 'playing' ? ` · ${snap.result.reason}` : ''}
              </p>
              {savedId && (
                <Link href={`/super-ai/${savedId}`} className="text-sm text-cdm-accent">기보 보기</Link>
              )}
            </div>
          )}
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <p className="mb-2 text-sm font-medium text-cdm-fg">기록</p>
          <ul className="space-y-1 text-sm text-cdm-fg-muted">
            {history.map((r, i) => (
              <li key={i}>
                R{i + 1} {r.iWasFirst ? '선' : '후'} {MBNW_TILE_COLOR[r.myTile] === 'black' ? '■' : '□'}{r.myTile}
                {' vs '}{r.oppColor === 'black' ? '■' : '□'}
                {r.mySuspected ? (r.mySuccess ? ' · 의심 성공' : ' · 의심 실패') : ''}
                {r.secondSkipped ? ' · 상대 스킵' : ''}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
