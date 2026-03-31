# The Genius — 온라인 보드게임 플랫폼

실시간 멀티플레이 보드게임 플랫폼입니다.  
현재 **사중력 사목(Four Gravity)** 을 지원하며, 추가 게임 모듈을 확장할 수 있는 구조입니다.

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand, Socket.IO Client |
| 백엔드 | Fastify, Socket.IO, TypeScript (ESM) |
| 공유 타입 | `shared/types/` — 클라이언트·서버 공용 |
| 패키지 관리 | pnpm workspace |
| 배포 | PM2 (`ecosystem.config.cjs`) |

## 개발 서버 실행

```bash
# 프론트엔드 + 서버 동시 실행
pnpm dev

# 개별 실행
pnpm dev:front   # Next.js (포트 3001)
pnpm dev:server  # Fastify + Socket.IO (포트 4001)
```

환경변수 (`.env.local`):
```
NEXT_PUBLIC_SOCKET_URL=http://localhost:4001
```

## 빌드 & 배포

```bash
pnpm build
pnpm release   # scripts/make-release.mjs 실행
```

PM2로 프로덕션 실행:
```bash
pm2 start ecosystem.config.cjs
```

## 프로젝트 구조

```
app/          Next.js App Router 페이지
components/   UI 컴포넌트 (ui/, lobby/, room/, game/, archive/)
hooks/        소켓 이벤트 훅 (useLobby, useRoom, useSocket 등)
stores/       Zustand 전역 상태 (lobby, room, nickname, archive)
lib/          socket 싱글톤, HTTP API, 유틸리티
shared/types/ 클라이언트·서버 공용 타입 및 상수 (GAME_IDS 등)
server/       Fastify + Socket.IO 서버
  src/socket/       소켓 핸들러
  src/socket/games/ 게임별 로직 (four-gravity 등)
  src/store/        인메모리 room·session 스토어
docs/         아키텍처 및 UX 문서 (welcome/, common/)
```

## 문서

- 온보딩: [`docs/welcome/`](docs/welcome/README.md)
- UX/기능 명세: [`docs/common/`](docs/common/README.md)
