import { describe, it, expect, beforeEach } from 'vitest';
import { sessions } from '../store/sessions.js';

// sessions도 모듈 레벨 Map이므로 각 테스트 전에 초기화
function resetSessions() {
  // 등록된 모든 소켓을 제거
  ['socket-a', 'socket-b', 'socket-c', 'socket-d'].forEach((id) => {
    sessions.clearRoom(id);
    sessions.removeSession(id);
  });
}

describe('sessions.setNickname', () => {
  beforeEach(resetSessions);

  it('새 닉네임을 설정하면 true를 반환한다', () => {
    const result = sessions.setNickname('socket-a', '닉네임A');
    expect(result).toBe(true);
  });

  it('설정한 닉네임을 getNickname으로 조회할 수 있다', () => {
    sessions.setNickname('socket-a', '닉네임A');
    expect(sessions.getNickname('socket-a')).toBe('닉네임A');
  });

  it('이미 사용 중인 닉네임은 false를 반환한다', () => {
    sessions.setNickname('socket-a', '중복닉네임');
    const result = sessions.setNickname('socket-b', '중복닉네임');
    expect(result).toBe(false);
  });

  it('같은 소켓이 닉네임을 변경하면 이전 닉네임이 해제된다', () => {
    sessions.setNickname('socket-a', '옛날닉네임');
    sessions.setNickname('socket-a', '새닉네임');
    expect(sessions.isNicknameTaken('옛날닉네임')).toBe(false);
    expect(sessions.isNicknameTaken('새닉네임')).toBe(true);
  });
});

describe('sessions.getSocketByNickname', () => {
  beforeEach(resetSessions);

  it('닉네임으로 소켓 ID를 찾을 수 있다', () => {
    sessions.setNickname('socket-a', '유저A');
    expect(sessions.getSocketByNickname('유저A')).toBe('socket-a');
  });

  it('없는 닉네임은 undefined를 반환한다', () => {
    expect(sessions.getSocketByNickname('없는닉네임')).toBeUndefined();
  });
});

describe('sessions.isNicknameTaken', () => {
  beforeEach(resetSessions);

  it('사용 중인 닉네임은 true를 반환한다', () => {
    sessions.setNickname('socket-a', '사용중');
    expect(sessions.isNicknameTaken('사용중')).toBe(true);
  });

  it('사용 안 하는 닉네임은 false를 반환한다', () => {
    expect(sessions.isNicknameTaken('미사용')).toBe(false);
  });
});

describe('sessions.removeSession', () => {
  beforeEach(resetSessions);

  it('세션 제거 후 닉네임도 해제된다', () => {
    sessions.setNickname('socket-a', '닉네임A');
    sessions.removeSession('socket-a');
    expect(sessions.getNickname('socket-a')).toBeUndefined();
    expect(sessions.isNicknameTaken('닉네임A')).toBe(false);
  });

  it('세션 제거 후 같은 닉네임을 다른 소켓이 사용할 수 있다', () => {
    sessions.setNickname('socket-a', '닉네임A');
    sessions.removeSession('socket-a');
    const result = sessions.setNickname('socket-b', '닉네임A');
    expect(result).toBe(true);
  });
});

describe('sessions.room 관리', () => {
  beforeEach(resetSessions);

  it('소켓에 방 ID를 설정하고 조회할 수 있다', () => {
    sessions.setRoom('socket-a', 'room-123');
    expect(sessions.getRoom('socket-a')).toBe('room-123');
  });

  it('방 ID를 지우면 undefined가 반환된다', () => {
    sessions.setRoom('socket-a', 'room-123');
    sessions.clearRoom('socket-a');
    expect(sessions.getRoom('socket-a')).toBeUndefined();
  });
});

describe('sessions.kick (강퇴)', () => {
  beforeEach(resetSessions);

  it('강퇴된 닉네임은 해당 방에서 isKicked가 true다', () => {
    sessions.addKick('강퇴유저', 'room-abc');
    expect(sessions.isKicked('강퇴유저', 'room-abc')).toBe(true);
  });

  it('강퇴되지 않은 유저는 false다', () => {
    expect(sessions.isKicked('일반유저', 'room-abc')).toBe(false);
  });

  it('다른 방에서는 강퇴 상태가 적용되지 않는다', () => {
    sessions.addKick('강퇴유저', 'room-abc');
    expect(sessions.isKicked('강퇴유저', 'room-xyz')).toBe(false);
  });

  it('방 삭제 시 해당 방의 강퇴 기록이 정리된다', () => {
    sessions.addKick('강퇴유저', 'room-abc');
    sessions.clearRoomFromAllKicks('room-abc');
    expect(sessions.isKicked('강퇴유저', 'room-abc')).toBe(false);
  });

  it('세션이 삭제되어도 강퇴 기록은 유지된다 (재접속 방지)', () => {
    sessions.setNickname('socket-a', '강퇴유저');
    sessions.addKick('강퇴유저', 'room-abc');
    sessions.removeSession('socket-a');
    // 강퇴 기록은 닉네임 기반이므로 세션 삭제 후에도 유지돼야 함
    expect(sessions.isKicked('강퇴유저', 'room-abc')).toBe(true);
  });

  it('같은 유저를 여러 방에서 강퇴할 수 있다', () => {
    sessions.addKick('강퇴유저', 'room-1');
    sessions.addKick('강퇴유저', 'room-2');
    expect(sessions.isKicked('강퇴유저', 'room-1')).toBe(true);
    expect(sessions.isKicked('강퇴유저', 'room-2')).toBe(true);
    // room-1만 삭제해도 room-2 강퇴는 유지
    sessions.clearRoomFromAllKicks('room-1');
    expect(sessions.isKicked('강퇴유저', 'room-1')).toBe(false);
    expect(sessions.isKicked('강퇴유저', 'room-2')).toBe(true);
  });
});
