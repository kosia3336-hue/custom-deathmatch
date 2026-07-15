import Image from 'next/image';
import Link from 'next/link';

/**
 * 로비 상단 메인 광고판.
 * 원본(16:9) 전체가 잘리지 않게 축소해 중앙 배치하고,
 * 가장자리를 잉크색 그라데이션으로 페이드시켜 다크 밴드와 자연스럽게 섞는다.
 * 클릭 시 신규 업데이트 공지로 이동.
 */
export default function MainBillboard() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <Image
        src="/brand/main-title.webp"
        alt="Custom Deathmatch"
        width={1152}
        height={648}
        priority
        className="h-auto w-full"
        sizes="(max-width: 640px) 100vw, 576px"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, var(--cdm-ink), transparent 14%, transparent 86%, var(--cdm-ink)), linear-gradient(to bottom, var(--cdm-ink), transparent 16%, transparent 84%, var(--cdm-ink))',
        }}
      />
      {/* 클릭 영역: 중앙 70%만 — 가장자리 오터치 방지 */}
      <Link
        href="/notice/4e5982fd-f102-4f77-ab17-58b8f8b09f4d"
        aria-label="신규 업데이트 공지 보기"
        className="absolute inset-x-[15%] inset-y-[15%] z-10 block"
      />
    </div>
  );
}
