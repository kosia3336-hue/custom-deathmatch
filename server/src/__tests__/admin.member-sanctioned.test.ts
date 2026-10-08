import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerAdminRoutes } from '../routes/admin.js';
import config from '../config.js';

function fakeSocket(memberId: string | null) {
  return { data: { member: memberId ? { id: memberId } : null }, disconnect: vi.fn() };
}

describe('/internal/member-sanctioned', () => {
  const tab1 = fakeSocket('m-1');
  const tab2 = fakeSocket('m-1');
  const other = fakeSocket('m-2');
  const guest = fakeSocket(null);
  const io = {
    sockets: {
      sockets: new Map<string, ReturnType<typeof fakeSocket>>([
        ['a', tab1],
        ['b', tab2],
        ['c', other],
        ['d', guest],
      ]),
    },
  };
  const app = Fastify();
  registerAdminRoutes(app, () => io as never);

  it('내부 키가 틀리면 403 이고 아무도 끊지 않는다', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/member-sanctioned',
      payload: { secret: 'wrong', memberId: 'm-1' },
    });
    expect(res.statusCode).toBe(403);
    expect(tab1.disconnect).not.toHaveBeenCalled();
  });

  it('memberId 가 없으면 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/member-sanctioned',
      payload: { secret: config.internalSecret },
    });
    expect(res.statusCode).toBe(400);
  });

  it('대상 회원의 소켓(여러 탭)만 끊는다', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/member-sanctioned',
      payload: { secret: config.internalSecret, memberId: 'm-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, disconnected: 2 });
    expect(tab1.disconnect).toHaveBeenCalledWith(true);
    expect(tab2.disconnect).toHaveBeenCalledWith(true);
    expect(other.disconnect).not.toHaveBeenCalled();
    expect(guest.disconnect).not.toHaveBeenCalled();
  });
});
