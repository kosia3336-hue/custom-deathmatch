import { describe, it, expect } from 'vitest';
import { classifyRestoreToken } from '../socket/index.js';

const TOKEN = '11111111-2222-3333-4444-555555555555';

describe('classifyRestoreToken', () => {
  it('회원에게 묶이지 않은 토큰은 그대로 복원한다', () => {
    expect(classifyRestoreToken(TOKEN, null, null)).toBe('restore');
    expect(classifyRestoreToken(TOKEN, null, 'member-a')).toBe('restore');
  });

  it('같은 회원이면 복원한다', () => {
    expect(classifyRestoreToken(TOKEN, 'member-a', 'member-a')).toBe('restore');
  });

  it('다른 회원의 토큰이면 새로 발급한다 (세션 탈취 차단)', () => {
    expect(classifyRestoreToken(TOKEN, 'member-a', 'member-b')).toBe('reissue');
  });

  it('형식이 틀린 토큰은 새로 발급한다', () => {
    expect(classifyRestoreToken(undefined, null, null)).toBe('reissue');
    expect(classifyRestoreToken('short', null, null)).toBe('reissue');
    expect(classifyRestoreToken(42, 'member-a', 'member-a')).toBe('reissue');
  });

  /*
    이 갈래가 이 파일의 이유다. 액세스 토큰 갱신이 한 번 실패하면 그 연결은
    게스트로 붙는데(authedMemberId=null), 예전에는 이걸 탈취와 같이 보아 새
    토큰을 발급하고 클라이언트의 localStorage 를 덮어썼다. 그러면 진행 중이던
    판에 묶인 토큰이 사라져 새로고침해도 게임으로 돌아오지 못했다.
  */
  it('인증이 안 붙은 연결이 회원 토큰을 들고 오면 재인증을 요구할 뿐 토큰을 버리지 않는다', () => {
    expect(classifyRestoreToken(TOKEN, 'member-a', null)).toBe('reauth');
  });
});
