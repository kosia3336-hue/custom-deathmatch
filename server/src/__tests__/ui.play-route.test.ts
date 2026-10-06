import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsxRuntime from 'react/jsx-runtime';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { GAME_IDS } from '@shared/types/game.js';

// 실제 플레이 라우트를 렌더링하되 소켓·라우터와 각 게임의 내부 화면만 대체한다.
// 밴픽의 전용 이벤트를 받기 전에 라우트가 모듈을 마운트하는지 검증한다.
const source = readFileSync(new URL('../../../app/room/[roomId]/play/page.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function renderPlay(gameId: string, stateRoomId: string | null, hiddenMatch = false, roomId = 'rank-room') {
  const store = {
    room: { id: roomId, gameId, hiddenMatch },
    gameState: stateRoomId ? { roomId: stateRoomId } : null,
  };
  const exports: { default?: ComponentType } = {};
  runInNewContext(compiled, {
    exports,
    require: (id: string) => {
      if (id === 'react/jsx-runtime') return jsxRuntime;
      if (id === 'react') return { useEffect: () => {} };
      if (id === 'next/navigation') return { useParams: () => ({ roomId: 'rank-room' }), useRouter: () => ({}) };
      if (id === 'sonner') return { toast: {} };
      if (id === '@/hooks/useRoom') return { useRoom: () => ({ gameResult: null }) };
      if (id === '@/stores/room') return { useRoomStore: (select: (s: typeof store) => unknown) => select(store) };
      if (id === '@/lib/socket') return {};
      if (id === '@/shared/types') return { GAME_IDS };
      if (id === '@/components/game/GameShell') return { default: ({ children }: { children: ReactNode }) => children };
      if (id.startsWith('@/components/game/')) {
        const name = id.split('/').at(-1);
        return { default: () => createElement('div', { 'data-module': name }) };
      }
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return renderToStaticMarkup(createElement(exports.default!));
}

describe('플레이 라우트의 데이터 대기', () => {
  it('랭크·일반 밴픽은 game:state 없이 전용 이벤트를 받을 화면을 마운트한다', () => {
    expect(renderPlay(GAME_IDS.BAN_PICK, null)).toContain('data-module="ban-pick"');
  });
  it('카운터 매치도 game:state 없이 전용 화면을 마운트한다', () => {
    expect(renderPlay(GAME_IDS.BAN_PICK, null, true)).toContain('data-module="counter-ban"');
  });
  it('일반 게임은 현재 방의 상태가 도착할 때까지 기다린다', () => {
    expect(renderPlay(GAME_IDS.NUMBER_FOUR, null)).toContain('data-module="GameLoading"');
    expect(renderPlay(GAME_IDS.NUMBER_FOUR, 'old-room')).toContain('data-module="GameLoading"');
    expect(renderPlay(GAME_IDS.NUMBER_FOUR, 'rank-room')).toContain('data-module="number4"');
  });
  it('이전 방 정보로 밴픽을 마운트하지 않는다', () => {
    expect(renderPlay(GAME_IDS.BAN_PICK, null, false, 'old-room')).toContain('data-module="GameLoading"');
  });
});
