const roomStartIntervals = new Map<string, ReturnType<typeof setInterval>>();

export function clearRoomStartCountdown(roomId: string): void {
  const id = roomStartIntervals.get(roomId);
  if (id !== undefined) {
    clearInterval(id);
    roomStartIntervals.delete(roomId);
  }
}

export function setRoomStartCountdown(
  roomId: string,
  interval: ReturnType<typeof setInterval>,
): void {
  clearRoomStartCountdown(roomId);
  roomStartIntervals.set(roomId, interval);
}

export function hasRoomStartCountdown(roomId: string): boolean {
  return roomStartIntervals.has(roomId);
}
