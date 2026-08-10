import { cn } from '@/lib/utils';

interface Props {
  /** 룰 이미지 URL (관리자 페이지에서 등록). 저장소 경로·스토리지 URL 모두 가능 */
  src: string;
  /** 게임 이름 — 대체 텍스트에 쓴다 */
  name: string;
  className?: string;
}

/**
 * 룰 이미지 — 룰 상세 페이지·소개 페이지·인게임 룰 모달이 함께 쓴다.
 * 세 곳의 생김새가 갈라지지 않도록 한 군데서만 렌더한다.
 *
 * next/image 대신 <img> 를 쓴다: 관리자가 올리는 이미지라 호스트도 크기도
 * 미리 알 수 없다(스토리지 임의 URL). 글씨가 빽빽한 룰 이미지는 재인코딩하면
 * 오히려 뭉개지므로 원본을 그대로 서빙하는 편이 낫기도 하다.
 */
export default function RuleImage({ src, name, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} 룰 안내 이미지`}
      loading="lazy"
      className={cn('h-auto w-full rounded-cdm-md border border-cdm-border', className)}
    />
  );
}
