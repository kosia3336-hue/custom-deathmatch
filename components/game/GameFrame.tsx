'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import styles from './game-frame.module.css';

/**
 * 게임 화면의 공통 뼈대 — 한 화면 안에 다 들어가게 한다.
 *
 * ── 왜 필요한가 ───────────────────────────────────────────────
 * 게임 화면은 스크롤이 생기는 순간 못 쓰게 된다. 판을 보려고 올리면 버튼이
 * 사라지고, 버튼을 누르려고 내리면 판이 사라진다. 한 수 둘 때마다 위아래를
 * 오가야 하니 손도 눈도 지친다. 그래서 게임 화면만큼은 '들어갈 만큼만 그린다'
 * 를 규칙으로 삼는다. 내용이 넘치면 스크롤을 붙이는 게 아니라 판을 줄인다.
 *
 * ── 세 칸 문법 ────────────────────────────────────────────────
 *   info     위   — 지금 상황. 차례·시간·점수·남은 말. 눈으로 읽기만 한다.
 *   children 가운데 — 무대. 판이나 카드 같은 게임의 본체. 남은 높이를 다 쓴다.
 *   controls 아래 — 조작. 누르는 것은 전부 여기. 엄지가 닿는 자리다.
 *   aside    옆   — 넓은 화면에서만 나오는 참고 정보(이동표 따위).
 *
 * 위가 정보, 아래가 조작인 건 손이 아래에 있기 때문이다. 조작을 위에 두면
 * 누르는 손이 판을 가린다. 참고 정보는 조작이 아니므로 좁은 화면에서는
 * aside 로 빼거나 모달로 접는다 — 늘 펼쳐 두면 그만큼 판이 작아진다.
 *
 * ── 쓰는 법 ───────────────────────────────────────────────────
 *   <GameFrame info={<Status/>} controls={<Actions/>} aside={<MoveTable/>}>
 *     <Board3D fit columns={5} .../>
 *   </GameFrame>
 *
 * info 와 controls 는 내용만큼만 차지하고 줄어들지 않는다(shrink-0). 무대는
 * 남은 높이를 받고, 그 높이를 자식이 cqh 로 읽어 판 크기를 정한다. 판에
 * `fit` 을 주면 남은 자리에 알아서 맞춰진다 — 화면 높이를 dvh 로 어림잡지
 * 말 것. 머리말·조작부 높이는 게임마다 다르므로 그 어림은 반드시 어긋난다.
 *
 * ── 어디에 놓는가 ────────────────────────────────────────────
 * GameShell 의 relative 상자, 또는 그 상자를 그대로 채우는 래퍼(absolute
 * inset-0) 바로 안에 놓아야 한다. 중간에 relative + h-full 짜리 래퍼가 끼면
 * 그 래퍼의 높이가 '내용만큼' 이 되어(자식이 absolute 라 0) 뼈대가 납작해진다.
 * 실제로 은행놀이에서 그렇게 깨졌다.
 *
 * ── 지켜야 할 것 ──────────────────────────────────────────────
 * · 뼈대와 무대는 절대 스크롤하지 않는다. 스크롤을 없애려고 만든 것을 스크롤로
 *   되돌리게 된다. 넘치면 줄이거나 접는다. 예외는 길이가 정해지지 않은 목록
 *   하나뿐이고(저장 목록·기록 로그), 그것도 aside 나 모달 안에서 높이를 묶는다.
 * · info 와 controls 는 낮게. 여기서 1rem 을 아끼면 판이 그만큼 커진다.
 * · 결과 배너처럼 잠깐 뜨는 것은 무대 위에 겹쳐 띄운다(overlay). 새 줄을
 *   만들면 그 순간 판이 밀려 작아진다.
 */
/**
 * 무대에 남은 높이에 맞춘 판 너비.
 *
 * GameFrame 의 무대 안에서만 뜻이 있다 — 무대가 container-type: size 라서
 * 100cqh 가 '남은 높이' 로 읽힌다. 화면 높이(dvh)로 어림잡지 말 것.
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
}: {
  /** 위 — 차례·시간·점수처럼 읽기만 하는 것 */
  info?: ReactNode;
  /** 아래 — 누르는 것 전부 */
  controls?: ReactNode;
  /** 옆 — 넓은 화면에서만 나오는 참고 정보 */
  aside?: ReactNode;
  /** 가운데 — 판·카드 같은 게임의 본체 */
  children: ReactNode;
  className?: string;
}) {
  return (
    /*
      GameShell 의 relative 박스에 absolute inset-0 으로 붙는다.

      h-full 로는 안 된다. 방 레이아웃이 min-h-screen 이라 조상 높이가 '내용
      만큼' 이고, 그러면 퍼센트 높이가 풀리지 않아 뼈대가 납작해진다. 반면
      inset-0 은 그 박스의 실제 크기에 그대로 맞는다. 흐름에서 빠지므로 방
      높이는 머리말+바닥글 = 화면 한 장으로 확정되고, 게임 칸은 그 나머지를
      정확히 받는다.
    */
    <div
      /*
        자리는 인라인으로 못 박는다. className 은 게임·스킨이 넘기는 값이라
        거기서 position 을 바꾸면 뼈대가 흐름으로 돌아가 내용 높이만큼
        납작해진다 — 실제로 흑과백2 서부 스킨의 .skin-showdown-stage-content
        가 relative 를 얹어 판이 잘리고 화면 아래가 텅 비었다.
        클래스끼리는 순서로 이기고 지므로, 이것만은 인라인으로 잠근다.
      */
      style={{ position: 'absolute', inset: 0 }}
      className={cn(
        'mx-auto flex w-full max-w-5xl flex-col gap-2 p-2 sm:gap-3 sm:p-3',
        className,
      )}
    >
      {info && <div className="shrink-0">{info}</div>}

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className={styles.stage}>{children}</div>
        {aside && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto overscroll-contain lg:block">
            {aside}
          </aside>
        )}
      </div>

      {controls && <div className="shrink-0">{controls}</div>}
    </div>
  );
}
