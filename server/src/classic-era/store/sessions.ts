const socketToNickname = new Map<string, string>();
const nicknameToSocket = new Map<string, string>();
const socketToRoom = new Map<string, string>();

// nickname → Set<roomId> : 소켓 ID가 아닌 닉네임 기준으로 저장해 재접속 후에도 강퇴가 유지됨
const kickedFromRoom = new Map<string, Set<string>>();

export const sessions = {
  setNickname(socketId: string, nickname: string): boolean {
    if (nicknameToSocket.has(nickname)) return false;
    const old = socketToNickname.get(socketId);
    if (old) nicknameToSocket.delete(old);
    socketToNickname.set(socketId, nickname);
    nicknameToSocket.set(nickname, socketId);
    return true;
  },

  getNickname(socketId: string): string | undefined {
    return socketToNickname.get(socketId);
  },

  getSocketByNickname(nickname: string): string | undefined {
    return nicknameToSocket.get(nickname);
  },

  isNicknameTaken(nickname: string): boolean {
    return nicknameToSocket.has(nickname);
  },

  removeSession(socketId: string) {
    const nickname = socketToNickname.get(socketId);
    if (nickname) nicknameToSocket.delete(nickname);
    socketToNickname.delete(socketId);
    socketToRoom.delete(socketId);
    // 강퇴 기록은 닉네임 기준이므로 여기서 삭제하지 않음 (재접속 시에도 강퇴 유지)
  },

  setRoom(socketId: string, roomId: string) {
    socketToRoom.set(socketId, roomId);
  },

  getRoom(socketId: string): string | undefined {
    return socketToRoom.get(socketId);
  },

  clearRoom(socketId: string) {
    socketToRoom.delete(socketId);
  },

  addKick(nickname: string, roomId: string) {
    if (!kickedFromRoom.has(nickname)) {
      kickedFromRoom.set(nickname, new Set());
    }
    kickedFromRoom.get(nickname)!.add(roomId);
  },

  isKicked(nickname: string, roomId: string): boolean {
    return kickedFromRoom.get(nickname)?.has(roomId) ?? false;
  },

  /** 방이 삭제될 때 해당 방에 대한 강퇴 기록을 전부 정리 */
  clearRoomFromAllKicks(roomId: string) {
    kickedFromRoom.forEach((rooms) => rooms.delete(roomId));
  },
};
