import { createHmac } from 'crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isDbgViewer } from '../socket/_dbg-viewer.js';

const SECRET = 'test-dbg-viewer-secret';
const MEMBER_A = '11111111-1111-4111-8111-111111111111';
const MEMBER_B = '22222222-2222-4222-8222-222222222222';
const MAC_A = createHmac('sha256', SECRET).update(MEMBER_A).digest('hex');

const prevSecret = process.env.DBG_VIEWER_SECRET;
const prevMac = process.env.DBG_VIEWER_MAC;

beforeEach(() => {
  process.env.DBG_VIEWER_SECRET = SECRET;
  process.env.DBG_VIEWER_MAC = MAC_A;
});

afterEach(() => {
  if (prevSecret === undefined) delete process.env.DBG_VIEWER_SECRET;
  else process.env.DBG_VIEWER_SECRET = prevSecret;
  if (prevMac === undefined) delete process.env.DBG_VIEWER_MAC;
  else process.env.DBG_VIEWER_MAC = prevMac;
});

describe('isDbgViewer', () => {
  it('시크릿·MAC이 맞고 멀티면 true', () => {
    expect(isDbgViewer('multi', MEMBER_A)).toBe(true);
    expect(isDbgViewer('com', MEMBER_A)).toBe(true);
  });

  it('다른 회원·솔로·관전 모드는 false', () => {
    expect(isDbgViewer('multi', MEMBER_B)).toBe(false);
    expect(isDbgViewer('solo', MEMBER_A)).toBe(false);
    expect(isDbgViewer('tutorial', MEMBER_A)).toBe(false);
    expect(isDbgViewer('multi', null)).toBe(false);
  });

  it('env가 비면 전부 false', () => {
    delete process.env.DBG_VIEWER_SECRET;
    delete process.env.DBG_VIEWER_MAC;
    expect(isDbgViewer('multi', MEMBER_A)).toBe(false);
  });

  it('시크릿만 있고 MAC이 없으면 false', () => {
    delete process.env.DBG_VIEWER_MAC;
    expect(isDbgViewer('multi', MEMBER_A)).toBe(false);
  });
});
