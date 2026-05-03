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
      <span aria-hidden className="mb-4 inline-flex items-end gap-1">
        <span className="block h-8 w-2 rounded-[2px] bg-cdm-primary" />
        <span className="block h-8 w-2 rounded-[2px] bg-cdm-accent" />
      </span>
      <p className="text-lg font-medium text-cdm-fg">아직 만들어진 방이 없어요!</p>
      <p className="mt-1 text-sm text-cdm-fg-muted">첫 번째 방을 만들어 보세요.</p>
      <Button className="mt-6" onClick={onCreate}>방 만들기</Button>
    </div>
  );
}
