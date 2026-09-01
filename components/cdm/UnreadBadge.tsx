import { cn } from '@/lib/utils';

/**
 * 미읽음 개수 배지.
 *
 * 같은 뜻인데 화면마다 모양이 달랐다 — 어떤 곳은 숫자 pill, 어떤 곳은 그냥 점,
 * 색도 브랜드색과 빨강이 섞여 있었다. 개수를 아는 자리는 전부 이 컴포넌트를 쓴다.
 *
 * 두 자리 수는 '9+' 로 줄인다. 배지는 '몇 개인지' 보다 '쌓여 있다' 를 알리는
 * 물건이라, 자리를 넓혀 가며 정확한 수를 보여 줄 이유가 없다.
 */
export function UnreadBadge({
  count,
  className,
  label,
}: {
  count: number;
  className?: string;
  /** 스크린리더용 설명. 아이콘 버튼 위에 얹을 때처럼 문맥이 없는 자리에서 쓴다. */
  label?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full',
        'bg-cdm-primary px-1 text-[10px] leading-none font-bold text-white',
        className,
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}
