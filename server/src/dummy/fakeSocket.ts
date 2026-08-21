import type { TypedSocket } from '../socket/types.js';

/** 더미는 진짜 소켓이 없다. 거절 에러는 삼키지 않고 남긴다. */
export function makeDummySocket(dummyId: string): TypedSocket {
  const noop = () => undefined;
  return {
    id: dummyId,
    emit: (event: string, payload?: unknown) => {
      if (event === 'error') {
        console.warn(`[dummySocket] ${dummyId.slice(0, 28)}`, payload);
      }
    },
    join: noop,
    leave: noop,
  } as unknown as TypedSocket;
}
