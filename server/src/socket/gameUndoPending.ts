export interface PendingGameUndo {
  requestId: string;
  requesterId: string;
  gameId: string;
}

const pendingUndoByRoom = new Map<string, PendingGameUndo>();

export function setPendingUndo(roomId: string, data: PendingGameUndo) {
  pendingUndoByRoom.set(roomId, data);
}

export function takePendingUndo(roomId: string, requestId: string): PendingGameUndo | null {
  const p = pendingUndoByRoom.get(roomId);
  if (!p || p.requestId !== requestId) return null;
  pendingUndoByRoom.delete(roomId);
  return p;
}

export function peekPendingUndo(roomId: string): PendingGameUndo | undefined {
  return pendingUndoByRoom.get(roomId);
}

export function clearPendingUndo(roomId: string) {
  pendingUndoByRoom.delete(roomId);
}
