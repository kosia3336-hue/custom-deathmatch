/*
  관리자 로그의 액션 유형 정의.

  AuditTabClient('use client') 안에 두었더니, 서버 컴포넌트인 AuditTab 이 값을
  import 할 때 Next 가 클라이언트 참조 프록시로 바꿔 배열이 아니게 됐다
  (ACTION_KINDS.includes is not a function → 필터를 걸면 500).
  서버·클라이언트가 함께 쓰는 상수라 클라이언트 경계 밖에 둔다.
*/
export const ACTION_LABELS: Record<string, { label: string; variant: string }> = {
  'member.suspend':        { label: '일시정지',     variant: 'warning' },
  'member.ban':            { label: '영구정지',     variant: 'danger'  },
  'member.lift':           { label: '제재 해제',    variant: 'success' },
  'member.set_role':       { label: '역할 변경',    variant: 'default' },
  'member.nickname_reset': { label: '닉네임 초기화', variant: 'default' },
  'title.create':          { label: '칭호 생성',    variant: 'accent'  },
  'title.update':          { label: '칭호 편집',    variant: 'accent'  },
  'title.grant':           { label: '칭호 부여',    variant: 'accent'  },
  'title.auto_grant':      { label: '칭호 자동부여', variant: 'accent'  },
  'title.revoke':          { label: '칭호 압수',    variant: 'danger'  },
  'report.resolve':        { label: '신고 처리',    variant: 'default' },
  'report.reject':         { label: '신고 반려',    variant: 'default' },
  'inquiry.answer':        { label: '문의 답변',    variant: 'default' },
  'inquiry.close':         { label: '문의 종결',    variant: 'default' },
  'agreement.publish':     { label: '약관 게시',    variant: 'default' },
  'word.add':              { label: '금칙어 추가',   variant: 'default' },
  'word.delete':           { label: '금칙어 삭제',   variant: 'default' },
  // 공지사항 (v2.7)
  'notice.create':         { label: '공지 등록',    variant: 'accent'  },
  'notice.update':         { label: '공지 편집',    variant: 'accent'  },
  'notice.pin':            { label: '공지 고정',    variant: 'default' },
  'notice.publish':        { label: '공지 공개',    variant: 'default' },
  'notice.delete':         { label: '공지 삭제',    variant: 'danger'  },
  // 상점 / CDP (v2.8)
  'cdp.adjust':            { label: 'CDP 조정',     variant: 'accent'  },
  'shop.item_create':      { label: '아이템 등록',  variant: 'accent'  },
  'shop.item_update':      { label: '아이템 편집',  variant: 'accent'  },
  'shop.item_set_active':  { label: '아이템 노출',  variant: 'default' },
};

export const ACTION_KINDS = Object.keys(ACTION_LABELS);
