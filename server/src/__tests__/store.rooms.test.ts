import { describe, it, expect, beforeEach } from 'vitest';
import { roomStore } from '../store/rooms.js';
import type { Player } from '@shared/types/room.js';

// roomStore는 모듈 레벨 Map을 사용하므로 각 테스트 전에 초기화 필요
// rooms Map은 외부 노출이 없어서, 모든 방을 getAll()로 얻어 삭제하는 방식으로 초기화
function resetRooms() {
  roomStore.getAll().forEach((r) => roomStore.delete(r.id));
}

function makeHost(overrides?: Partial<Player>): Player {
  return {
    id: 'host-socket-id',
    nickname: '호스트',
    isHost: true,
    isReady: false,
    joinedAt: Date.now(),
    ...overrides,
  };
}

function makePlayer(id: string, nickname = '플레이어'): Player {
  return {
    id,
    nickname,
    isHost: false,
    isReady: false,
    joinedAt: Date.now(),
  };
}

function createMultiRoom(host: Player = makeHost()) {
  return roomStore.create({
    title: '테스트 방',
    gameId: 'four-gravity',
    gameName: '사목',
    playMode: 'multi',
    roomType: 'public',
    maxPlayers: 2,
    minPlayers: 2,
    host,
  });
}

describe('roomStore.create', () => {
  beforeEach(resetRooms);

  it('방을 생성하면 id가 부여되고 Map에 저장된다', () => {
    const room = createMultiRoom();
    expect(room.id).toBeDefined();
    expect(room.id.length).toBeGreaterThan(0);
    expect(roomStore.get(room.id)).toBeDefined();
  });

  it('멀티 방은 status가 waiting이다', () => {
    const room = createMultiRoom();
    expect(room.status).toBe('waiting');
  });

  it('솔로 방은 status가 playing이다', () => {
    const host = makeHost();
    const room = roomStore.create({
      title: '솔로 방',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'solo',
      roomType: 'public',
      maxPlayers: 1,
      minPlayers: 1,
      host,
    });
    expect(room.status).toBe('playing');
    expect(room.maxPlayers).toBe(1);
  });

  it('COM 방은 AI 플레이어가 자동 추가된다', () => {
    const host = makeHost();
    const room = roomStore.create({
      title: 'COM 방',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'com',
      roomType: 'public',
      maxPlayers: 2,
      minPlayers: 2,
      host,
    });
    expect(room.players.length).toBe(2);
    expect(room.players.some((p) => p.id === 'AI')).toBe(true);
  });

  it('COM 방도 비밀번호를 저장할 수 있다', () => {
    const room = roomStore.create({
      title: '비밀 COM 방',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'com',
      roomType: 'private',
      password: '1234',
      maxPlayers: 2,
      minPlayers: 2,
      host: makeHost(),
    });

    expect(room.roomType).toBe('private');
    expect(roomStore.getPassword(room.id)).toBe('1234');
  });

  it('비밀번호가 있으면 private 방에 저장된다', () => {
    const host = makeHost();
    const room = roomStore.create({
      title: '비밀 방',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'multi',
      roomType: 'private',
      password: '1234',
      maxPlayers: 2,
      minPlayers: 2,
      host,
    });
    expect(roomStore.getPassword(room.id)).toBe('1234');
  });

  it('생성된 방의 hostId는 호스트 소켓 ID와 일치한다', () => {
    const host = makeHost({ id: 'my-host-id' });
    const room = createMultiRoom(host);
    expect(room.hostId).toBe('my-host-id');
  });
});

describe('roomStore.addPlayer', () => {
  beforeEach(resetRooms);

  it('대기 중 방에 플레이어를 추가할 수 있다', () => {
    const room = createMultiRoom();
    const player = makePlayer('player-2');
    const added = roomStore.addPlayer(room.id, player);
    expect(added).toBe(true);
    expect(roomStore.get(room.id)?.players.length).toBe(2);
  });

  it('방이 가득 찼으면 추가 불가', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    const added = roomStore.addPlayer(room.id, makePlayer('player-3'));
    expect(added).toBe(false);
  });

  it('게임 중인 방에는 추가 불가', () => {
    const room = createMultiRoom();
    roomStore.setStatus(room.id, 'playing');
    const added = roomStore.addPlayer(room.id, makePlayer('player-2'));
    expect(added).toBe(false);
  });
});

describe('roomStore.removePlayer', () => {
  beforeEach(resetRooms);

  it('마지막 플레이어가 나가면 방이 삭제된다', () => {
    const room = createMultiRoom();
    const result = roomStore.removePlayer(room.id, 'host-socket-id');
    expect(result.destroyed).toBe(true);
    expect(roomStore.get(room.id)).toBeUndefined();
  });

  it('호스트가 나가면 다음 플레이어에게 호스트가 위임된다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    const result = roomStore.removePlayer(room.id, 'host-socket-id');
    expect(result.destroyed).toBe(false);
    expect(result.newHostId).toBe('player-2');
    expect(roomStore.get(room.id)?.hostId).toBe('player-2');
  });

  it('일반 플레이어가 나가도 방은 유지된다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    const result = roomStore.removePlayer(room.id, 'player-2');
    expect(result.destroyed).toBe(false);
    expect(result.newHostId).toBeUndefined();
    expect(roomStore.get(room.id)).toBeDefined();
  });

  it('AI만 남으면 방이 삭제된다', () => {
    const host = makeHost();
    const room = roomStore.create({
      title: 'COM 방',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'com',
      roomType: 'public',
      maxPlayers: 2,
      minPlayers: 2,
      host,
    });
    const result = roomStore.removePlayer(room.id, 'host-socket-id');
    expect(result.destroyed).toBe(true);
  });
});

describe('roomStore.canStart', () => {
  beforeEach(resetRooms);

  it('최소 인원 미달이면 시작 불가', () => {
    const room = createMultiRoom();
    const result = roomStore.canStart(room.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('최소');
  });

  it('비호스트 플레이어가 준비 안 하면 시작 불가', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    const result = roomStore.canStart(room.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('준비');
  });

  it('모든 비호스트 플레이어가 준비하면 시작 가능', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    roomStore.setPlayerReady(room.id, 'player-2', true);
    const result = roomStore.canStart(room.id);
    expect(result.ok).toBe(true);
  });

  it('이미 playing 상태면 시작 불가', () => {
    const room = createMultiRoom();
    roomStore.setStatus(room.id, 'playing');
    const result = roomStore.canStart(room.id);
    expect(result.ok).toBe(false);
  });
});

describe('roomStore.delegateHost', () => {
  beforeEach(resetRooms);

  it('호스트를 다른 플레이어에게 위임할 수 있다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    const success = roomStore.delegateHost(room.id, 'player-2');
    expect(success).toBe(true);
    expect(roomStore.get(room.id)?.hostId).toBe('player-2');
    const players = roomStore.get(room.id)?.players ?? [];
    expect(players.find((p) => p.id === 'player-2')?.isHost).toBe(true);
    expect(players.find((p) => p.id === 'host-socket-id')?.isHost).toBe(false);
  });

  it('존재하지 않는 플레이어에게 위임 불가', () => {
    const room = createMultiRoom();
    const success = roomStore.delegateHost(room.id, 'non-existent');
    expect(success).toBe(false);
  });
});

describe('roomStore.swapPlayers', () => {
  beforeEach(resetRooms);

  it('2명일 때 순서를 교체할 수 있다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    const before = roomStore.get(room.id)!.players.map((p) => p.id);
    roomStore.swapPlayers(room.id);
    const after = roomStore.get(room.id)!.players.map((p) => p.id);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
  });

  it('1명이면 교체 실패', () => {
    const room = createMultiRoom();
    const result = roomStore.swapPlayers(room.id);
    expect(result).toBe(false);
  });
});

describe('roomStore.findQuickJoinRoom', () => {
  beforeEach(resetRooms);

  it('대기 중인 공개 멀티 방을 찾아 반환한다', () => {
    const room = createMultiRoom();
    const found = roomStore.findQuickJoinRoom();
    expect(found?.id).toBe(room.id);
  });

  it('방이 가득 찬 경우 반환하지 않는다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    const found = roomStore.findQuickJoinRoom();
    expect(found).toBeUndefined();
  });

  it('게임 중인 방은 반환하지 않는다', () => {
    const room = createMultiRoom();
    roomStore.setStatus(room.id, 'playing');
    const found = roomStore.findQuickJoinRoom();
    expect(found).toBeUndefined();
  });

  it('인원이 더 많은 방을 우선 반환한다', () => {
    const host1 = makeHost({ id: 'host-1' });
    const host2 = makeHost({ id: 'host-2' });
    const room1 = roomStore.create({
      title: '방 1',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: 4,
      minPlayers: 2,
      host: host1,
    });
    const room2 = roomStore.create({
      title: '방 2',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: 4,
      minPlayers: 2,
      host: host2,
    });
    roomStore.addPlayer(room2.id, makePlayer('extra-player'));
    const found = roomStore.findQuickJoinRoom();
    expect(found?.id).toBe(room2.id);
  });
});

describe('roomStore.createInviteToken', () => {
  beforeEach(resetRooms);

  it('초대 토큰을 생성하고 방 ID로 조회할 수 있다', () => {
    const room = createMultiRoom();
    const token = roomStore.createInviteToken(room.id);
    expect(token).toBeTruthy();
    expect(roomStore.getRoomByInviteToken(token)).toBe(room.id);
  });

  it('방 삭제 시 초대 토큰도 정리된다', () => {
    const room = createMultiRoom();
    const token = roomStore.createInviteToken(room.id);
    roomStore.delete(room.id);
    expect(roomStore.getRoomByInviteToken(token)).toBeUndefined();
  });
});

describe('roomStore.moveToSpectator / moveToPlayer', () => {
  beforeEach(resetRooms);

  it('플레이어를 관전자로 이동할 수 있다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    const moved = roomStore.moveToSpectator(room.id, 'player-2');
    expect(moved).toBe(true);
    const r = roomStore.get(room.id)!;
    expect(r.players.some((p) => p.id === 'player-2')).toBe(false);
    expect(r.spectators.some((p) => p.id === 'player-2')).toBe(true);
  });

  it('호스트는 관전자로 이동 불가', () => {
    const room = createMultiRoom();
    const moved = roomStore.moveToSpectator(room.id, 'host-socket-id');
    expect(moved).toBe(false);
  });

  it('관전자를 플레이어로 이동할 수 있다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    roomStore.moveToSpectator(room.id, 'player-2');
    const moved = roomStore.moveToPlayer(room.id, 'player-2');
    expect(moved).toBe(true);
    const r = roomStore.get(room.id)!;
    expect(r.players.some((p) => p.id === 'player-2')).toBe(true);
    expect(r.spectators.some((p) => p.id === 'player-2')).toBe(false);
  });
});

describe('roomStore.changePlayMode', () => {
  beforeEach(resetRooms);

  it('멀티에서 COM으로 바꾸면 방장 외 사람을 관전자로 이동하고 AI를 추가한다', () => {
    const room = roomStore.create({
      title: '모드 변경 방',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: 4,
      minPlayers: 2,
      timeLimitSeconds: 120,
      host: makeHost(),
    });
    roomStore.addPlayer(room.id, makePlayer('player-2', '둘째'));
    roomStore.addPlayer(room.id, makePlayer('player-3', '셋째'));

    const result = roomStore.changePlayMode(room.id, 'com', { minPlayers: 2, maxPlayers: 2 });
    const changed = roomStore.get(room.id)!;

    expect(result?.aiJoined).toBe(true);
    expect(result?.movedPlayers.map((player) => player.id)).toEqual(['player-2', 'player-3']);
    expect(changed.playMode).toBe('com');
    expect(changed.maxPlayers).toBe(2);
    expect(changed.players.map((player) => player.id)).toEqual(['host-socket-id', 'AI']);
    expect(changed.spectators.map((player) => player.id)).toEqual(['player-2', 'player-3']);
    expect(changed.timeLimitSeconds).toBeNull();
  });

  it('COM에서 멀티로 바꾸면 AI를 제거하고 기존 관전자는 관전자 상태를 유지한다', () => {
    const room = roomStore.create({
      title: 'COM 방',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'com',
      roomType: 'public',
      maxPlayers: 2,
      minPlayers: 2,
      host: makeHost(),
    });
    roomStore.addSpectator(room.id, makePlayer('spectator-1', '관전자'));

    const result = roomStore.changePlayMode(room.id, 'multi', { minPlayers: 2, maxPlayers: 4 });
    const changed = roomStore.get(room.id)!;

    expect(result?.aiLeft).toBe(true);
    expect(changed.playMode).toBe('multi');
    expect(changed.maxPlayers).toBe(4);
    expect(changed.players.map((player) => player.id)).toEqual(['host-socket-id']);
    expect(changed.spectators.map((player) => player.id)).toEqual(['spectator-1']);
  });

  it('솔로로 바꾸면 방장 한 자리로 정리되고 바로 시작 가능한 상태가 된다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));

    roomStore.changePlayMode(room.id, 'solo', { minPlayers: 2, maxPlayers: 1 });

    expect(roomStore.get(room.id)?.players.map((player) => player.id)).toEqual(['host-socket-id']);
    expect(roomStore.canStart(room.id).ok).toBe(true);
  });
});

describe('roomStore.resetHumanReadiness', () => {
  beforeEach(resetRooms);

  it('일반 설정 변경 시 사람 참가자의 준비 상태를 해제한다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    roomStore.setPlayerReady(room.id, 'player-2', true);

    const resetIds = roomStore.resetHumanReadiness(room.id);

    expect(resetIds).toEqual(['player-2']);
    expect(roomStore.get(room.id)?.players.find((player) => player.id === 'player-2')?.isReady).toBe(false);
  });
});

describe('roomStore.resetForRematch', () => {
  beforeEach(resetRooms);

  it('리매치 시 상태가 waiting으로 되고 준비 상태가 초기화된다', () => {
    const room = createMultiRoom();
    roomStore.addPlayer(room.id, makePlayer('player-2'));
    roomStore.setPlayerReady(room.id, 'player-2', true);
    roomStore.setStatus(room.id, 'finished');

    roomStore.resetForRematch(room.id);

    const r = roomStore.get(room.id)!;
    expect(r.status).toBe('waiting');
    expect(r.players.every((p) => !p.isReady)).toBe(true);
  });
});
