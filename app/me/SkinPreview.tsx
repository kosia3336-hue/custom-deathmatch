import type { SkinTheme } from '@/lib/skins/registry';

const CLIP_FIRST = 'polygon(15% 100%, 0% 30%, 50% 0%, 100% 30%, 85% 100%)';
const CLIP_SECOND = 'polygon(15% 0%, 0% 70%, 50% 100%, 100% 70%, 85% 0%)';

/** 마이페이지 스킨 카드용 정적 비주얼 프리뷰 (게임 데이터 불필요) */
export default function SkinPreview({ theme }: { theme: SkinTheme }) {
  if (theme === 'citadel') {
    return (
      <div className="skin-citadel-field skin-citadel-preview relative flex h-24 w-full items-end justify-center gap-1 overflow-hidden rounded-lg p-2">
        <div className="skin-citadel-fx" aria-hidden>
          <div className="skin-citadel-torch skin-citadel-torch--left skin-citadel-torch--static" />
        </div>
        <div className="relative z-10 flex h-full flex-1 items-end justify-center gap-0.5">
          {(['A', 'B', 'C', 'D', 'E'] as const).map((id) => (
            <div
              key={id}
              className={`skin-citadel-tower skin-citadel-preview-tower flex flex-1 flex-col overflow-hidden rounded border ${
                id === 'C' ? 'skin-citadel-tower-complete' : `skin-citadel-tower--${id.toLowerCase()}`
              }`}
            >
              <div
                className={`skin-citadel-pillar flex flex-col items-center py-0.5 ${
                  id === 'C' ? 'skin-citadel-pillar--lit' : ''
                }`}
              >
                <span className="text-[8px] font-bold">{id}</span>
                {id === 'C' && <span className="skin-citadel-flame skin-citadel-flame--on" aria-hidden />}
              </div>
              <div className="flex flex-1 flex-col justify-end gap-px">
                {id === 'C' ? (
                  <div className="skin-citadel-cell skin-citadel-cell--done h-2 w-full">
                    <span className="skin-citadel-block h-full w-full">
                      <span className="skin-citadel-block-engrave">10</span>
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="skin-citadel-cell skin-citadel-cell--filled skin-citadel-cell--crest h-2 w-full">
                      <span className="skin-citadel-block h-full w-full">
                        <span className="skin-citadel-block-engrave">2</span>
                      </span>
                    </div>
                    <div className="skin-citadel-cell skin-citadel-cell--empty h-2 w-full">
                      <span className="skin-citadel-block h-full w-full">
                        <span className="skin-citadel-block-engrave">1</span>
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (theme === 'nocturne') {
    return (
      <div className="skin-nocturne-table relative flex h-24 w-full items-center justify-center gap-2 overflow-hidden rounded-lg p-2">
        <div className="skin-nocturne-fx" aria-hidden>
          <div className="skin-nocturne-spotlight" />
          <div className="skin-nocturne-stars" />
        </div>
        <span className="relative z-10 skin-nocturne-card-wrap skin-nocturne-card-wrap--face skin-nocturne-card--sm h-12 w-9">
          <div className="skin-nocturne-card-face-inner skin-nocturne-card--sm h-full w-full">
            <span className="skin-nocturne-card-value">7</span>
          </div>
        </span>
        <span className="relative z-10 skin-nocturne-card-wrap skin-nocturne-card-wrap--back skin-nocturne-card--sm h-12 w-9">
          <div className="skin-nocturne-card-back-inner skin-nocturne-card--sm h-full w-full">
            <div className="skin-nocturne-back-stars" aria-hidden />
            <div className="skin-nocturne-moon" aria-hidden>
              <span className="skin-nocturne-moon-disc" />
              <span className="skin-nocturne-moon-shade" />
            </div>
          </div>
        </span>
        <span className="relative z-10 skin-nocturne-card-wrap skin-nocturne-card-wrap--face skin-nocturne-card--sm h-12 w-9">
          <div
            className="skin-nocturne-card-face-inner skin-nocturne-card--sm h-full w-full"
            style={{ animation: 'none' }}
          >
            <span className="skin-nocturne-card-value">3</span>
          </div>
        </span>
      </div>
    );
  }

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
