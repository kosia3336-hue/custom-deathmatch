'use client';

import { createContext, useContext, ReactNode } from 'react';

/**
 * 게임 모듈이 상단 바에 얹는 것.
 *
 * 라운드·선/후는 게임마다 뜻이 달라(gameData 안에 있다) 셸이 알 수 없다.
 * 그래서 모듈이 채우고, 셸은 자리와 모양만 정한다 — 게임이 달라도 같은
 * 자리에서 같은 모양으로 읽히게 하려는 것이다.
 */
export interface GameHud {
  /** 라운드. "3 / 11" 처럼 짧게. 길면 좁은 화면에서 타이머를 밀어낸다. */
  round?: ReactNode;
  /** 선/후 같은 차례 표시. 한두 글자. */
  order?: ReactNode;
  /** 상단 바 바로 아래 얇은 줄. 라운드 진행 현황을 칸으로 나눠 보인다. */
  progress?: ReactNode;
  /**
   * 좁은 화면에서 '메모' 아이콘으로 여는 것 — 라운드 기록, 상대 잔여 추리 따위.
   * 넓은 화면에서는 GameFrame 의 aside 로 옆에 펴 두므로 여기 넣지 않아도 된다.
   * null 이면 메모 아이콘 자체가 안 나온다.
   */
  memo?: ReactNode;
}

export interface RoomLayoutContextValue {
  /** 상단 바 왼쪽. 게임 화면이 방 제목 자리를 대신 쓴다. null 이면 방 제목이 나온다. */
  setHeaderLeft: (content: ReactNode) => void;
  setHeaderRight: (content: ReactNode) => void;
  /** 상단 바 아래에 붙는 얇은 줄. */
  setHeaderBelow: (content: ReactNode) => void;
  setFooter: (content: ReactNode) => void;
  /** true면 sticky 푸터 바를 렌더하지 않음 (모달과 겹침·클릭 가로채기 방지) */
  setFooterHidden: (hidden: boolean) => void;
  /** 게임 모듈이 상단 바에 얹는 것. 모듈에서 부른다. */
  setHud: (hud: GameHud | null) => void;
  hud: GameHud | null;
}

export const RoomLayoutContext = createContext<RoomLayoutContextValue | null>(null);

export function useRoomLayout() {
  const ctx = useContext(RoomLayoutContext);
  if (!ctx) throw new Error('useRoomLayout must be used within RoomLayout');
  return ctx;
}
