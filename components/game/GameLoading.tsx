import { ProgressRing } from '@/components/cdm/ProgressRing';

/** 모든 게임 모듈의 데이터 로딩에 사용하는 공통 시각 표시. */
export default function GameLoading({ label = '게임을 불러오는 중' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center p-4">
      <ProgressRing size={40} label={label} />
    </div>
  );
}
