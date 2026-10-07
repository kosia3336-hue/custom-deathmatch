'use client';
import { useGameAction } from '@/components/game/GameActionContext';

import { FT_TOWERS } from '@/shared/types';
import type {
  FTAction,
  FTGameData,
  FTItem,
  FTStackCount,
  FTTower,
} from '@/shared/types/five-towers';
import { useMemo, useState } from 'react';
import { TOWER_COLORS } from './InferenceField';

interface ActionPanelProps {
  gameData: FTGameData;
  myId: string;
  isMyTurn: boolean;
  disabled: boolean;
}

type Tab = 'stack' | 'item';

export default function ActionPanel({ gameData, myId, isMyTurn, disabled }: ActionPanelProps) {
  const sendAction = useGameAction();
  const [tab, setTab] = useState<Tab>('stack');
  const [tower, setTower] = useState<FTTower | null>(null);
  const [count, setCount] = useState<FTStackCount>(1);
  const [item, setItem] = useState<FTItem | null>(null);
  const [infoTargets, setInfoTargets] = useState<FTTower[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const me = gameData.players[myId];
  const itemUsed = me?.itemUsed ?? false;

  const incompleteTowers = useMemo(
    () => FT_TOWERS.filter((t) => !gameData.towers[t].completed),
    [gameData.towers],
  );

  const submit = (action: FTAction) => {
    if (submitting) return;
    setSubmitting(true);
    sendAction(action as unknown as Record<string, unknown>);
  };

  const onStackSubmit = () => {
    if (!tower) return;
    submit({ type: 'stack', tower, count });
  };

  const onItemSubmit = () => {
    if (!item) return;
    if (item === 'info') {
      if (infoTargets.length !== 2) return;
      submit({ type: 'item', item: 'info', targets: [infoTargets[0], infoTargets[1]] });
    } else if (item === 'zero') {
      if (!tower) return;
      submit({ type: 'item', item: 'zero', target: tower });
    } else if (item === 'secret') {
      if (!tower) return;
      submit({ type: 'item', item: 'secret', target: tower, count });
    }
  };

  if (!isMyTurn) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-400">
        상대 차례를 기다리는 중...
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-indigo-200 bg-white p-3 sm:p-4 ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => {
            setTab('stack');
            setItem(null);
            setInfoTargets([]);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'stack' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          쌓기
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('item');
            setTower(null);
            setCount(1);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'item' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'
          } ${itemUsed ? 'cursor-not-allowed opacity-50' : ''}`}
          disabled={itemUsed}
          title={itemUsed ? '이미 아이템을 사용했습니다.' : '아이템 사용'}
        >
          아이템 {itemUsed ? '(사용함)' : ''}
        </button>
      </div>

      {tab === 'stack' && (
        <>
          <div className="text-xs font-medium text-gray-600">탑 선택</div>
          <div className="grid grid-cols-5 gap-1.5">
            {FT_TOWERS.map((t) => {
              const completed = gameData.towers[t].completed;
              const sel = tower === t;
              const cs = TOWER_COLORS[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => !completed && setTower(t)}
                  disabled={completed}
                  className={`rounded-lg border-2 py-2 text-base font-bold transition-all ${
                    completed
                      ? 'border-yellow-300 bg-yellow-100 text-yellow-700 line-through opacity-50'
                      : sel
                        ? `${cs.border} ${cs.bg} ${cs.text} ring-2 ring-indigo-400 ring-offset-1`
                        : `border-gray-200 bg-white ${cs.text} hover:bg-gray-50`
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="text-xs font-medium text-gray-600">칸 수</div>
          <div className="grid grid-cols-3 gap-1.5">
            {([1, 2, 3] as FTStackCount[]).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setCount(n)}
                className={`rounded-lg border-2 py-2 text-base font-bold transition-all ${
                  count === n
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {n}칸
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onStackSubmit}
            disabled={!tower || submitting}
            className="rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {tower ? `${tower}탑에 ${count}칸 쌓기` : '탑을 선택하세요'}
          </button>
        </>
      )}

      {tab === 'item' && (
        <>
          <div className="text-xs font-medium text-gray-600">아이템 선택 (1회만 사용 가능)</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['info', 'zero', 'secret'] as FTItem[]).map((it) => {
              const sel = item === it;
              const label = { info: '정보', zero: '제로', secret: '시크릿' }[it];
              const desc = { info: '두 탑 합', zero: '0칸 위장', secret: '비밀 쌓기' }[it];
              const tone = {
                info: 'border-sky-300 bg-sky-50 text-sky-700',
                zero: 'border-slate-300 bg-slate-50 text-slate-700',
                secret: 'border-purple-300 bg-purple-50 text-purple-700',
              }[it];
              return (
                <button
                  key={it}
                  type="button"
                  onClick={() => {
                    setItem(it);
                    setTower(null);
                    setInfoTargets([]);
                    setCount(1);
                  }}
                  className={`flex flex-col items-center rounded-lg border-2 px-1 py-2 text-xs transition-all ${
                    sel
                      ? `${tone} ring-2 ring-indigo-400 ring-offset-1`
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-sm font-bold">{label}</span>
                  <span className="text-[11px] opacity-75">{desc}</span>
                </button>
              );
            })}
          </div>

          {item === 'info' && (
            <>
              <div className="text-xs font-medium text-gray-600">두 탑 선택</div>
              <div className="grid grid-cols-5 gap-1.5">
                {FT_TOWERS.map((t) => {
                  const completed = gameData.towers[t].completed;
                  const sel = infoTargets.includes(t);
                  const cs = TOWER_COLORS[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (completed) return;
                        setInfoTargets((prev) => {
                          if (prev.includes(t)) return prev.filter((x) => x !== t);
                          if (prev.length >= 2) return [prev[1], t];
                          return [...prev, t];
                        });
                      }}
                      disabled={completed}
                      className={`rounded-lg border-2 py-2 text-base font-bold transition-all ${
                        completed
                          ? 'border-yellow-300 bg-yellow-100 text-yellow-700 line-through opacity-50'
                          : sel
                            ? `${cs.border} ${cs.bg} ${cs.text} ring-2 ring-indigo-400 ring-offset-1`
                            : `border-gray-200 bg-white ${cs.text} hover:bg-gray-50`
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={onItemSubmit}
                disabled={infoTargets.length !== 2 || submitting}
                className="rounded-lg bg-sky-600 py-2.5 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {infoTargets.length === 2
                  ? `${infoTargets[0]}+${infoTargets[1]} 합 확인`
                  : '두 탑을 선택하세요'}
              </button>
            </>
          )}

          {(item === 'zero' || item === 'secret') && (
            <>
              <div className="text-xs font-medium text-gray-600">탑 선택</div>
              <div className="grid grid-cols-5 gap-1.5">
                {FT_TOWERS.map((t) => {
                  const completed = gameData.towers[t].completed;
                  const sel = tower === t;
                  const cs = TOWER_COLORS[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => !completed && setTower(t)}
                      disabled={completed}
                      className={`rounded-lg border-2 py-2 text-base font-bold transition-all ${
                        completed
                          ? 'border-yellow-300 bg-yellow-100 text-yellow-700 line-through opacity-50'
                          : sel
                            ? `${cs.border} ${cs.bg} ${cs.text} ring-2 ring-indigo-400 ring-offset-1`
                            : `border-gray-200 bg-white ${cs.text} hover:bg-gray-50`
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>

              {item === 'secret' && (
                <>
                  <div className="text-xs font-medium text-gray-600">칸 수 (비공개로 쌓음)</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([1, 2, 3] as FTStackCount[]).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCount(n)}
                        className={`rounded-lg border-2 py-2 text-base font-bold transition-all ${
                          count === n
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {n}칸
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={onItemSubmit}
                disabled={!tower || submitting}
                className={`rounded-lg py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-300 ${
                  item === 'zero'
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
              >
                {tower
                  ? item === 'zero'
                    ? `${tower}탑에 0칸 (위장)`
                    : `${tower}탑에 ${count}칸 비밀 쌓기`
                  : '탑을 선택하세요'}
              </button>
            </>
          )}

          {incompleteTowers.length === 0 && (
            <p className="text-xs text-gray-400">모든 탑이 완성되어 아이템을 사용할 수 없습니다.</p>
          )}
        </>
      )}
    </div>
  );
}
