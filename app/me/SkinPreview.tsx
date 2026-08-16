import type { SkinTheme } from '@/lib/skins/registry';

const CLIP_FIRST = 'polygon(15% 100%, 0% 30%, 50% 0%, 100% 30%, 85% 100%)';
const CLIP_SECOND = 'polygon(15% 0%, 0% 70%, 50% 100%, 100% 70%, 85% 0%)';

/** 마이페이지 스킨 카드용 정적 비주얼 프리뷰 (게임 데이터 불필요) */
/*
  렌더 안에서 정의하면 렌더마다 새 타입이 되어 React 가 매번 서브트리를 다시
  마운트한다. 바깥 상태를 쓰지 않으므로 모듈 스코프로 올린다.
*/
function ShowdownBundle({ state }: { state: 'lit' | 'active' }) {
  return (
    <span className={`skin-showdown-round skin-showdown-round--law skin-showdown-round--${state}`} style={{ position: 'relative' }}>
      <span className="skin-showdown-round-loop" />
      <span className="skin-showdown-round-bullets">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="skin-showdown-round-bullet">
            <span className="skin-showdown-cartridge-tip" />
            <span className="skin-showdown-cartridge-case" />
          </span>
        ))}
      </span>
    </span>
  );
}

export default function SkinPreview({ theme }: { theme: SkinTheme }) {
  if (theme === 'duality') {
    return (
      <div className="skin-duality-field relative flex h-24 w-full items-center overflow-hidden rounded-lg">
        <div className="skin-duality-fx" aria-hidden>
          <div className="skin-duality-split-line" />
          <div className="skin-duality-frost-glow" />
          <div className="skin-duality-ember-glow" />
        </div>
        <div className="relative z-10 flex w-full items-center justify-between px-5">
          {/* 빙결 타일 */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skin-duality-tile skin-duality-tile--frost skin-duality-tile--xs" />
              ))}
            </div>
            <span style={{ fontSize: '0.6rem', color: '#7dd3fc', letterSpacing: '0.05em', fontWeight: 600 }}>FROST</span>
          </div>

          {/* 중앙 넘버 카드 샘플 */}
          <div
            className="flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5"
            style={{
              background: 'rgba(9,14,28,0.92)',
              border: '1.5px solid rgba(96,165,250,0.65)',
              boxShadow: '0 0 14px rgba(96,165,250,0.4)',
            }}
          >
            <span className="text-xl font-bold leading-none" style={{ color: '#60a5fa', textShadow: '0 0 10px #60a5fa' }}>
              2
            </span>
            <span className="text-[10px] font-bold" style={{ color: '#60a5fa' }}>+2</span>
          </div>

          {/* 흑요석 타일 */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skin-duality-tile skin-duality-tile--obsidian skin-duality-tile--xs" />
              ))}
            </div>
            <span style={{ fontSize: '0.6rem', color: '#fb923c', letterSpacing: '0.05em', fontWeight: 600 }}>VOID</span>
          </div>
        </div>
      </div>
    );
  }

  if (theme === 'meow') {
    return (
      <div className="skin-meow-field relative flex h-24 w-full items-center justify-center gap-1.5 overflow-hidden rounded-lg">
        <div className="skin-meow-fx" aria-hidden>
          <span className="skin-meow-paw" style={{ left: '10%', top: '20%' }}>🐾</span>
          <span className="skin-meow-paw" style={{ left: '82%', top: '65%', animationDelay: '3s' }}>🐾</span>
        </div>
        <div className="relative z-10 flex items-end gap-1.5 pt-2">
          {([0, 1, 2, 3, 4] as const).map((t) => (
            <div key={t} className={`skin-meow-tile-sprite skin-meow-tile-sprite--${t} h-12`} />
          ))}
        </div>
      </div>
    );
  }

  if (theme === 'candy') {
    return (
      <div className="skin-bg-candy skin-candy-field relative flex h-24 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg">
        <div className="skin-candy-fx" aria-hidden>
          <span className="skin-candy-sparkle" style={{ left: '10%', top: '15%' }}>✦</span>
          <span className="skin-candy-sparkle" style={{ left: '85%', top: '60%', animationDelay: '2s' }}>✦</span>
        </div>
        <div className="skin-candy-round relative z-10 w-32">
          <span className="skin-candy-round-text text-xs">R 2 / 8</span>
        </div>
        <div className="relative z-10 flex gap-1">
          {(['minus3', 'plus5', 'copy', 'grapeBless', 'spaceCrush'] as const).map((c) => (
            <div key={c} className={`skin-candy-card skin-candy-card--${c} w-8`} />
          ))}
        </div>
      </div>
    );
  }

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

  if (theme === 'showdown') {
    return (
      <div className="skin-showdown-stage-bg relative flex h-24 w-full items-center justify-center gap-3 overflow-hidden rounded-lg px-4">
        <ShowdownBundle state="lit" />
        <div className="skin-showdown-wanted-poster" style={{ transform: 'rotate(-3deg)' }} aria-hidden>
          <div className="skin-showdown-wanted-title">WANTED</div>
          <div className="skin-showdown-wanted-photo">
            <span className="skin-showdown-bullet-hole skin-showdown-bullet-hole--black" />
          </div>
          <div className="skin-showdown-wanted-sub">DEAD&nbsp;OR&nbsp;ALIVE</div>
        </div>
        <ShowdownBundle state="active" />
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
