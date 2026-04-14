'use client';

import { getSocket } from '@/lib/socket';

interface Props {
  disabled?: boolean;
}

export default function RoleSelector({ disabled }: Props) {
  function selectRole(role: 'match' | 'bet') {
    getSocket().emit('game:action', { type: 'selectRole', role });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 text-center text-sm font-medium text-amber-800">
        역할을 선택하세요
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => selectRole('match')}
          disabled={disabled}
          className="flex-1 rounded-lg border-2 border-blue-300 bg-white py-3 text-sm font-bold text-blue-700 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <div className="text-base">승부</div>
          <div className="mt-0.5 text-[11px] font-normal text-blue-500">승·무·패 직접 선택</div>
        </button>
        <button
          onClick={() => selectRole('bet')}
          disabled={disabled}
          className="flex-1 rounded-lg border-2 border-emerald-300 bg-white py-3 text-sm font-bold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <div className="text-base">베팅</div>
          <div className="mt-0.5 text-[11px] font-normal text-emerald-500">예측 + 칩 베팅</div>
        </button>
      </div>
    </div>
  );
}
