import type { SkinTheme } from '@/lib/skins/registry';

const CLIP_FIRST = 'polygon(15% 100%, 0% 30%, 50% 0%, 100% 30%, 85% 100%)';
const CLIP_SECOND = 'polygon(15% 0%, 0% 70%, 50% 100%, 100% 70%, 85% 0%)';

/** 마이페이지 스킨 카드용 정적 비주얼 프리뷰 (게임 데이터 불필요) */
export default function SkinPreview({ theme }: { theme: SkinTheme }) {
  if (theme === 'cosmos') {
    return (
      <div className="skin-cosmos-board relative h-24 w-full overflow-hidden rounded-lg">
        <div className="skin-cosmos-fx" aria-hidden>
          <div className="skin-cosmos-stars" />
          <div className="skin-cosmos-nebula" />
        </div>
        <div className="relative z-10 flex h-full items-center justify-center gap-3">
          <span className="skin-cosmos-stone skin-cosmos-stone-black block h-7 w-7" />
          <span className="relative flex h-7 w-7 items-center justify-center">
            <span className="skin-cosmos-neutral" />
          </span>
          <span className="skin-cosmos-stone skin-cosmos-stone-white block h-7 w-7" />
        </div>
      </div>
    );
  }

  return (
    <div className="skin-imperial-board relative flex h-24 w-full items-center justify-center gap-3 overflow-hidden rounded-lg">
      <span
        className="skin-imperial-piece skin-imperial-piece-first flex h-9 w-9 items-center justify-center text-xs font-bold"
        style={{ clipPath: CLIP_FIRST }}
      >
        楚
      </span>
      <span
        className="skin-imperial-piece skin-imperial-piece-second flex h-9 w-9 items-center justify-center text-xs font-bold"
        style={{ clipPath: CLIP_SECOND }}
      >
        漢
      </span>
    </div>
  );
}
