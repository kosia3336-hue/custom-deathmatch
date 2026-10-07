'use client';

export function DigitHintPanel({
  firstNick,
  firstDigits,
  myDigitsHint,
  isFirstSelf,
  meow,
}: {
  firstNick: string;
  firstDigits: number | null;
  myDigitsHint: number | null;
  isFirstSelf: boolean;
  meow?: boolean;
}) {
  if (firstDigits == null && myDigitsHint == null) return null;
  return (
    <div
      className={`digit-hint-enter flex w-full flex-col gap-1 px-4 py-3 text-center ${
        meow ? 'skin-meow-panel' : 'rounded-xl border border-indigo-200 bg-white'
      }`}
    >
      {firstDigits != null && (
        <p className={`text-sm ${meow ? 'skin-meow-heading' : 'text-gray-600'}`}>
          <span className="font-medium">{firstNick}</span>{' '}
          <span className={`text-xs ${meow ? 'skin-meow-subtext' : 'text-gray-400'}`}>(선플)</span>{' '}
          :{' '}
          <span
            className={`text-2xl font-bold tabular-nums ${meow ? 'skin-meow-heading' : 'text-indigo-700'}`}
          >
            {firstDigits}
          </span>
          자리
        </p>
      )}
      {isFirstSelf && firstDigits == null && myDigitsHint != null && myDigitsHint > 0 && (
        <p className={`text-xs ${meow ? 'skin-meow-subtext' : 'text-gray-500'}`}>
          내 제시:{' '}
          <span
            className={`font-bold tabular-nums ${meow ? 'skin-meow-heading' : 'text-indigo-700'}`}
          >
            {myDigitsHint}자리
          </span>
        </p>
      )}
    </div>
  );
}
