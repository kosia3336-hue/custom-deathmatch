# 커스텀 데스매치 (Custom Deathmatch)

> 브라우저에서 바로 즐기는 1:1 보드/카드 게임 플랫폼.
> v2 — 카카오 로그인, 칭호, 게임 로그, 베이지안 평균 랭킹, 신고/문의, 관리자 페이지.

기획서: [`docs/v2/`](docs/v2/README.md) (17개 문서, DB 스키마 포함).

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, Zustand, Socket.IO Client |
| 인증 / DB | **Supabase** (Kakao OAuth Provider, PostgreSQL, RLS) |
| 백엔드 | Fastify, Socket.IO, TypeScript (ESM) |
| 공유 타입 | `shared/types/` |
| 패키지 관리 | pnpm workspace |
| 배포 | PM2 (`ecosystem.config.cjs`) |

## 첫 셋업

### 1) 환경변수

`.env.local` (프론트):
```
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`server/.env`:
```
PORT=4001
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3001
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # ⚠️ 비밀
```

### 2) Supabase 셋업

Dashboard → Authentication:
- **URL Configuration** → Site URL: `https://your-domain` / Redirect URLs: `http://localhost:3001/auth/callback`, `https://your-domain/auth/callback`
- **Providers → Kakao** ON — Kakao Developers 의 REST API Key + Client Secret 등록

### 3) DB 마이그레이션 실행

`supabase/migrations/` 안의 SQL 을 **순서대로** Supabase SQL Editor 에서 실행:

| 순서 | 파일 | 내용 |
|------|------|------|
| 0 | (수동) | 17번 기획서의 ENUM/테이블/RLS (이미 사용자가 실행 완료) |
| 1 | `01_phase2_rpc.sql` | 회원 RPC (가입/닉변/탈퇴 등 8개) |
| 2 | `02_phase2_seed.sql` | 약관 v1 + game_meta 14개 시드 |
| 3 | `03_phase6_rpc.sql` | 신고/문의 RPC 3개 |
| 4 | `04_phase7_admin_rpc.sql` | 관리자 RPC 10개 |

### 4) 첫 관리자 지정

자기 회원가입을 먼저 완료한 뒤, Supabase SQL Editor 에서:

```sql
update public.members_private
   set role = 'admin'
 where member_id = (select id from public.members where nickname = 'YOUR_NICKNAME');
```

이후 GNB 우측 드롭다운에서 [관리자] 메뉴가 노출됩니다 → `/admin` 진입.

## 개발 서버 실행

```bash
pnpm dev          # 프론트(3001) + 서버(4001) 동시 실행
pnpm dev:front    # Next.js 만
pnpm dev:server   # Fastify + Socket.IO 만
```

## 빌드 / 배포

```bash
pnpm build
pnpm release      # scripts/make-release.mjs
pm2 start ecosystem.config.cjs
```

## 프로젝트 구조

```
app/                 Next.js App Router 페이지
  login/             카카오 로그인
  signup/            가입 — agreement / profile
  auth/              callback / signout
  suspended/         일시정지 풀스크린
  banned/            영구정지 안내
  me/                마이페이지 — 6 탭 + log/[id]
  ranking/           랭킹 (게임별 + 주/월/전체)
  support/inquiry/   문의 작성
  legal/[kind]/      약관 뷰어
  admin/             관리자 페이지 (6 섹션)
  room/[roomId]/     대기실 / 인게임 / 결과·로그

components/cdm/      v2 디자인 시스템 (단일 라이트 테마, 인디고/코랄/앰버)
  Logo / TitleBadge / TurnBadge / StatusChip / PlayerIdentity / Marks
  Button / KakaoButton / Card / TextInput / Modal / Tabs / Spinner / EmptyState
  Tag / Skeleton / Countdown / GNB / ReportModal

components/         v1 컴포넌트 (디자인 토큰만 v2 갱신)
  layout / lobby / room / game / archive / ui / providers

hooks/              useSocket / useRoom / useLobby / useCurrentMember 등
lib/
  supabase/         client / server / middleware / database.types / rpc / env
  auth/server.ts    getAuthState / getActiveMember
  site.ts           getSiteUrl / getOAuthRedirectUrl
  socket.ts         access_token 전달 socket
proxy.ts            Next 16 proxy — 인증 가드 (정지/영구정지/관리자)
shared/types/       클라이언트·서버 공용 (Player/Room/ChatMessage/...)
server/             Fastify + Socket.IO
  src/db/           supabase admin / member 조회
  src/socket/       소켓 핸들러 (auth middleware, chat, room, game, lobby)
  src/store/        rooms / sessions
supabase/migrations/  Phase 별 RPC + 시드
```

## 동작 흐름 (요약)

```
[로그인 안 됨] → /login (카카오 버튼)
       ↓
[카카오 OAuth] → /auth/callback (code → 세션)
       ↓
[가입 미완료] → /signup/agreement → /signup/profile (complete_signup RPC)
       ↓
[정상] → / (로비)  /  [일시정지] → /suspended (문의·로그아웃만)  /  [영구정지] → /banned

[방 입장] → /room/[id] (대기실 — 칭호/선후공/방장 토글/관전자 통합 채팅)
       ↓
[게임 시작] → /room/[id]/play (인게임 셸)
       ↓
[게임 종료] → /room/[id]/result (결과 헤더 + archive viewer + 채팅 + 120초 카운트다운)
              ↓ 동시에 server 가 record_game_end RPC 로 game_logs / member_game_stats 적재
              ↓
[자동 이동 / 다시하기 / 로비로]
```

## 마이페이지 (`/me`)

| 탭 | 내용 |
|----|------|
| 개요 | 누적 전적 요약 위젯 |
| 게임 로그 | 본인 참가 game_logs (모드/결과/상대 칭호+선후공) |
| 전적 | 멀티 모드 누적 통계 (게임별 + 선/후공 분리) |
| 보유 칭호 | 표시 칭호 변경 / 해제 |
| 지원 | 보낸 신고 / 보낸 문의 |
| 설정 | 닉네임 변경 / 로그아웃 / 회원 탈퇴 |

## 랭킹 (`/ranking`)

- 게임별 + 주간/월간/전체
- **베이지안 평균 점수** (`compute_ranking` RPC, game_meta.bayesian_c 기반)
- AI/솔로 통계 미반영, 영구정지/탈퇴 회원 제외

## 관리자 (`/admin`)

| 섹션 | 기능 |
|------|------|
| 대시보드 | 활성 회원 / 정지 / 미처리 신고·문의 / 게임 로그 누계 |
| 회원 | 닉 검색 + 일시정지 / 영구정지 / 제재 해제 / 칭호 부여 / 관리자 부여 |
| 칭호 | 신규 생성 (이름·색·설명) + 전체 칭호 목록 + ID 복사 |
| 신고 | 처리 — 경고 / 일시정지 / 영구정지 / 반려 |
| 문의 | 답변 작성 |
| 감사 로그 | 모든 관리자 액션 자동 기록 (payload JSON 포함) |

## 문서

- 기획서: [`docs/v2/README.md`](docs/v2/README.md) (17개)
- v1 보존: [`docs/common/`](docs/common/README.md), [`docs/welcome/`](docs/welcome/README.md)
