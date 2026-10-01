import { cn } from '@/lib/utils';

/** 아이콘 크기 스케일 — sm: 버튼 안/인라인, md: 헤더 액션(기본), lg: 탭바/메뉴 시트 */
const SIZE = { sm: 16, md: 18, lg: 20 } as const;

/**
 * CDM 공용 아이콘.
 *
 * 규격: 24 viewBox · strokeWidth 1.8 · linecap/linejoin round · fill none · currentColor.
 * 새 아이콘은 반드시 이 파일의 PATHS 에 등록하고, 컴포넌트에서 inline <svg> 를 직접 쓰지 않는다.
 * 의미가 겹치는 이름을 새로 만들지 말 것 — 공지/소리 아이콘이 같아진 사고의 원인이었다.
 */
const PATHS = {
  // ── 알림·소리 (절대 섞지 말 것) ──
  notice: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  soundOn: 'M11 5 6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14',
  soundOff: 'M11 5 6 9H2v6h4l5 4V5zM22 9l-6 6M16 9l6 6',
  chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  // 우편함. 종(notice)과 뜻이 겹치지 않게 봉투로 따로 둔다.
  mail: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 6 9-6',

  // ── 내비게이션 ──
  menu: 'M4 6h16M4 12h16M4 18h16',
  home: 'M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  rank: 'M8 21V10M12 21V3M16 21v-7M4 21h16',
  me: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',

  // ── 메뉴 항목 ──
  title: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.2 13.9 7 23l5-3 5 3-1.2-9.1',
  shop: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  guild:
    'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  attendance:
    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M9 16l2 2 4-4',

  // ── 액션 ──
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6z',
  // 삭제. 뚜껑·몸통·안쪽 두 줄. 지우는 자리에는 글자 대신 이걸 쓴다.
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  // 시계. 흘러간·남은 시간(우편 기한, 플레이 시간)에 쓴다. 종(notice)과 달리 알림이 아니다.
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  // 스톱워치. '제한 시간' 설정(방의 턴 시간 제한)에만 쓴다 — 위 꼭지로 시계(clock)와 갈린다.
  timer: 'M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4l2.5 1.5M10 2h4M12 2v4',
  // 자물쇠. 비밀방. 예전 열쇠 모양은 작게 줄이면 가로 막대로만 보여 바꿨다.
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
  // 연결 끊김. 인터넷 연결이 없을 때의 안내(OfflineOverlay)에만 쓴다.
  wifiOff:
    'M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01',
  // 공유. 점 셋을 잇는 모양 — 전적·결과를 밖으로 보낸다.
  share:
    'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98',
  // 닫기. 시트·모달을 내린다. 지우기(trash)와 헷갈리지 말 것 — 되돌릴 수 있다.
  close: 'M6 6l12 12M6 18L18 6',
  // 뒤로. 목록으로 돌아가는 자리.
  chevronLeft: 'M15 6 9 12l6 6',
  // 열기. 목록 한 줄이 무언가를 연다는 표시 — 글자로 '보기/열기' 를 쓰지 않는다.
  chevronRight: 'M9 6l6 6-6 6',
  // 톱니. 게임 화면 상단 바의 '설정' — 소리·룰·채팅·나가기가 그 안에 있다.
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  // 정보. 방 제목·게임·플레이 모드처럼 '읽기만 하는' 것을 편다.
  //  반지름 10 — 톱니(settings)가 2~22 를 쓰므로 9 로 두면 나란히 놓았을 때 작아 보인다.
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  // 메모. 좁은 화면에서 라운드 기록·상대 추리를 여는 자리.
  //  공책 모양이라 정보(info)·설정(settings)과 뜻이 겹치지 않는다.
  memo: 'M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 9h8M8 13h8M8 17h5',
  /*
    문의하기. 말풍선 안의 물음표다.
    · chat 은 '대화' 라 잡담·채팅에 이미 쓰고 있어 겹친다
    · mail(봉투)은 우편함 몫이라 문의로 쓰면 둘이 헷갈린다
    그래서 물음표를 넣어 '묻는 곳' 임을 아이콘 자체로 드러낸다.
  */
  inquiry:
    'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2zM9.1 8.5a3 3 0 0 1 5.8 1c0 2-3 2.5-3 2.5M12 14.5h.01',
} as const;

export type IconName = keyof typeof PATHS;

/** path 로 못 그리는 아이콘(rect 조합 등)은 여기서 예외 처리한다. */
const SHAPES: Partial<Record<IconName | 'game', React.ReactNode>> = {
  game: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M8 9h4M8 14h8" />
    </>
  ),
};

interface IconProps {
  name: IconName | 'game';
  size?: keyof typeof SIZE;
  /** 채움 — 활성 탭 등 상태 표현용. 기본은 outline */
  filled?: boolean;
  className?: string;
}

/**
 * 광학 보정 — 그림이 24 상자를 넘치게 쓰는 아이콘만 줄인다.
 *
 * px 는 상자 크기일 뿐이고 눈에 보이는 크기는 그림이 실제로 차지하는 넓이가
 * 정한다. 대부분은 18~20 안에 드는데 톱니만 22 라, 상단 바에서 'i' 옆에
 * 나란히 놓았을 때 혼자 커 보였다. 24 상자 안에서 20 으로 줄여 맞춘다.
 *
 * 선 굵기는 여기서 함께 줄지 않도록 vector-effect 로 고정한다 — 굵기 1.8 은
 * 크기와 무관한 규격이다.
 */
const OPTICAL_SCALE: Partial<Record<IconName | 'game', number>> = {
  settings: 20 / 22,
};

export function Icon({ name, size = 'md', filled = false, className }: IconProps) {
  const px = SIZE[size];
  const scale = OPTICAL_SCALE[name];
  const shape = SHAPES[name] ?? <path d={PATHS[name as IconName]} />;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn(className)}
    >
      {scale ? (
        <g
          transform={`translate(12 12) scale(${scale}) translate(-12 -12)`}
          vectorEffect="non-scaling-stroke"
        >
          {shape}
        </g>
      ) : (
        shape
      )}
    </svg>
  );
}
