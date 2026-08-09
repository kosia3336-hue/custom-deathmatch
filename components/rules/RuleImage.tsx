import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ruleImagePath, RULE_IMAGE_WIDTH, RULE_IMAGE_HEIGHT } from '@/lib/gameRules';

interface Props {
  gameId: string;
  /** 게임 이름 — 대체 텍스트에 쓴다 */
  name: string;
  /**
   * 첫 화면에 바로 보이는 한 장일 때만 켠다(룰 상세 페이지).
   * 소개 페이지 룰 섹션처럼 여러 장을 미리 렌더해 두는 곳에서는 꺼서
   * 보이지 않는 이미지까지 내려받지 않게 한다.
   */
  priority?: boolean;
  /**
   * 이미지 아래 돋보기 표시. 소개 페이지 룰 캐러셀처럼 돋보기를
   * 캔버스 밖에 따로 두는 곳에서는 끈다.
   */
  caption?: boolean;
  className?: string;
}

/** 돋보기(확대) — 눌러서 원본 크기로 볼 수 있다는 표시 */
export function ZoomIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

/**
 * 룰 이미지 — 룰 상세 페이지와 소개 페이지 룰 섹션이 함께 쓴다.
 * 두 곳의 생김새가 갈라지지 않도록 한 군데서만 렌더한다.
 *
 * 이미지 유무는 public/rules/<gameId>.webp 존재 여부로 판정한다
 * (lib/gameRulesServer.ts 의 hasRuleImage) — 호출부에서 확인 후 렌더할 것.
 */
export default function RuleImage({
  gameId,
  name,
  priority = false,
  caption = true,
  className,
}: Props) {
  const src = ruleImagePath(gameId);

  return (
    <figure className={cn('mb-6', className)}>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-cdm-md border border-cdm-border transition hover:border-cdm-primary"
      >
        <Image
          src={src}
          alt={`${name} 룰 안내 이미지 — 같은 내용이 아래에 글로도 있습니다.`}
          width={RULE_IMAGE_WIDTH}
          height={RULE_IMAGE_HEIGHT}
          priority={priority}
          // 글씨가 빽빽한 이미지라 재인코딩(기본 q75)하면 글자가 뭉갠다.
          // 원본이 이미 표시 해상도에 맞춘 webp(약 100~124KB)이므로 그대로 서빙한다.
          unoptimized
          className="h-auto w-full"
        />
      </a>
      {caption && (
        <figcaption className="mt-2 flex justify-center text-cdm-fg-muted">
          <ZoomIcon />
          <span className="sr-only">이미지를 누르면 원본 크기로 볼 수 있습니다.</span>
        </figcaption>
      )}
    </figure>
  );
}
