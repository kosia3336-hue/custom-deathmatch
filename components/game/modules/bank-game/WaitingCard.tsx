'use client';

interface Props {
  text: string;
  subtext?: string;
}

export default function WaitingCard({ text, subtext }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-5">
      <span className="inline-flex items-center gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
      </span>
      <p className="text-sm text-gray-500">{text}</p>
      {subtext && <p className="text-[11px] text-gray-400">{subtext}</p>}
    </div>
  );
}
