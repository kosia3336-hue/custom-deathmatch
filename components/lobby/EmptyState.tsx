import Image from 'next/image';
import Button from '@/components/ui/Button';

interface Props {
  hasFilter: boolean;
  onCreate: () => void;
}

export default function EmptyState({ hasFilter, onCreate }: Props) {
  if (hasFilter) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-cdm-fg">검색 결과가 없습니다.</p>
        <p className="mt-1 text-sm text-cdm-fg-muted">다른 검색어나 필터를 사용해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Image
        src="/brand/logo3.webp"
        alt="Custom Deathmatch"
        width={160}
        height={115}
        className="mb-4 h-auto w-40"
      />
      <p className="text-lg font-medium text-cdm-fg">아직 만들어진 방이 없습니다!</p>
      <p className="mt-1 text-sm text-cdm-fg-muted">첫 번째 방을 만들어 보세요.</p>
      <Button className="mt-6" onClick={onCreate}>방 만들기</Button>
    </div>
  );
}
