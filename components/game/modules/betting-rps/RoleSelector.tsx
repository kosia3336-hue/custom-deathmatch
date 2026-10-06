'use client';

interface Props {
  onSelectRole: (role: 'match' | 'bet') => void;
  disabled?: boolean;
}

export default function RoleSelector({ onSelectRole, disabled }: Props) {
  function selectRole(role: 'match' | 'bet') {
    if (!disabled) onSelectRole(role);
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-6">
      <div className="flex gap-3 sm:gap-4">
        <button
          onClick={() => selectRole('match')}
          disabled={disabled}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 border-blue-300 bg-white py-5 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-6"
        >
          <div className="text-xl font-bold text-blue-700 sm:text-2xl">승부</div>
          <div className="text-sm font-semibold text-blue-500 sm:text-base">승·무·패 선택</div>
        </button>
        <button
          onClick={() => selectRole('bet')}
          disabled={disabled}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 border-emerald-300 bg-white py-5 transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 sm:py-6"
        >
          <div className="text-xl font-bold text-emerald-700 sm:text-2xl">베팅</div>
          <div className="text-sm font-semibold text-emerald-500 sm:text-base">예측 + 칩 베팅</div>
        </button>
      </div>
    </div>
  );
}
