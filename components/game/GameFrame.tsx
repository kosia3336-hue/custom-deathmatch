'use client';

import { useMemo, type ReactNode } from 'react';
import type { GameTool } from '@/contexts/GameToolsContext';
import { useGameToolRegistration } from '@/hooks/useGameToolRegistration';
import { cn } from '@/lib/utils';
import styles from './game-frame.module.css';

/**
 * 게임 화면의 공통 뼈대 — 점수/판/조작 및 메모가 서로 가리지 않게 한다.
 * info와 controls는 자연 높이를 유지한다. GameToolsWorkspace는 판의 최소 높이와
 * 이 영역들의 실제 높이를 합산해 캔버스를 확장하며, 화면보다 길면 전체를 스크롤한다.
 * 판은 확보된 높이를 container query(cqh)로 읽어 크기를 맞춘다.
 * 내용의 고유 높이가 필요한 판은 data-game-intrinsic-stage로 표시한다.
 * 긴 기록·채팅 목록의 독립 스크롤과 도킹은 유지하되, 창 높이를 줄인다는 이유로
 * 게임판이나 버튼을 숨기거나 접근할 수 없게 잘라서는 안 된다.
 * GameFrame은 GameToolsWorkspace의 상대 위치 게임 칸에 absolute inset으로 붙는다.
 */
/**
 * 무대에 확보한 높이에 맞춘 판 너비.
 *
 * GameFrame 의 무대 안에서만 뜻이 있다 — 무대가 container-type: size 라서
 * 100cqh 가 '확보한 무대 높이' 로 읽힌다. 화면 높이(dvh)로 어림잡지 말 것.
 *
 * outerY / outerX 는 판 상자 바깥에 더 붙는 여백이다(테두리·그림자 자리).
 * 없으면 0 으로 두면 된다.
 */
export function fitBoardWidth(
  columns: number,
  rows: number,
  maxWidth: string,
  outerY = '0rem',
  outerX = '0rem',
) {
  return `min(${maxWidth}, calc((100cqh - ${outerY}) * ${columns / rows} + ${outerX}))`;
}

export function GameFrame({
  info,
  controls,
  aside,
  children,
  className,
  tools,
}: {
  /** 위 — 차례·시간·점수처럼 읽기만 하는 것 */
  info?: ReactNode;
  /** 아래 — 누르는 것 전부 */
  controls?: ReactNode;
  /** PC 참고 정보 원본 — GameInfoPart마다 별도 도킹 창으로 표시한다. */
  aside?: ReactNode;
  /** 가운데 — 판·카드 같은 게임의 본체 */
  children: ReactNode;
  className?: string;
  /** PC에서 독립적으로 옮길 편의기능. mobileSlot은 좁은 화면의 기존 위치를 가리킨다. */
  tools?: GameTool[];
}) {
  const panels = useMemo<GameTool[]>(
    () => [
      ...(tools ?? []),
      ...(aside
        ? [{ id: 'reference', title: '편의기능', content: aside, preferredBodyHeight: 320 }]
        : []),
    ],
    [tools, aside],
  );
  const desktop = useGameToolRegistration(panels);
  const showInfo = !desktop || !tools?.some((tool) => tool.mobileSlot === 'info');
  const showControls = !desktop || !tools?.some((tool) => tool.mobileSlot === 'controls');
  return (
    /*
      GameShell 의 relative 박스에 absolute inset-0 으로 붙는다.

      h-full 로는 안 된다. 방 레이아웃이 min-h-screen 이라 조상 높이가 '내용
      만큼' 이고, 그러면 퍼센트 높이가 풀리지 않아 뼈대가 납작해진다. 반면
      inset-0 은 그 박스의 실제 크기에 그대로 맞는다. 바깥 workspace가 점수·
      조작부와 판의 최소 높이를 합산해 칸 높이를 확보하고 스크롤을 담당한다.
    */
    <div
      /*
        자리는 인라인으로 못 박는다. className 은 게임·스킨이 넘기는 값이라
        거기서 position 을 바꾸면 뼈대가 흐름으로 돌아가 내용 높이만큼
        납작해진다 — 실제로 흑과백2 서부 스킨의 .skin-showdown-stage-content
        가 relative 를 얹어 판이 잘리고 화면 아래가 텅 비었다.
        클래스끼리는 순서로 이기고 지므로, 이것만은 인라인으로 잠근다.
      */
      /*
        아래쪽은 시스템 영역(홈 인디케이터·제스처 바)만큼 띄운다.

        지금은 viewport-fit=cover 를 쓰지 않아(2026-09-10, 38ac879) 브라우저가
        화면을 시스템 바 안쪽까지만 그리고, 이 값은 대개 0 이다. 그래도 cover 를
        다시 켜거나 안전영역 값을 넘겨주는 웹뷰에서는 100vh 가 홈 인디케이터
        아래까지 내려가 판의 맨 밑줄이 가린다 — 흑과백2 '맨 밑이 살짝 잘린다'
        신고가 그것이었다. 그때를 위해 남겨 둔다.

        inset:0 대신 bottom 만 올린다. 안쪽 padding 은 게임이 className 으로
        정하므로 건드리지 않는다. (값: app/globals.css 의 --cdm-safe-bottom)
      */
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 'var(--cdm-safe-bottom, 0px)',
      }}
      data-game-frame
      className={cn(
        styles.frame,
        'mx-auto flex w-full max-w-5xl flex-col gap-2 p-2 sm:gap-3 sm:p-3',
        className,
      )}
    >
      {info && showInfo && <div className="shrink-0">{info}</div>}

      <div
        data-game-stage-row
        className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch"
      >
        <div className={styles.stage}>{children}</div>
        {aside && !desktop && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto overscroll-contain lg:block">
            {aside}
          </aside>
        )}
      </div>

      {controls && showControls && <div className="shrink-0">{controls}</div>}
    </div>
  );
}
