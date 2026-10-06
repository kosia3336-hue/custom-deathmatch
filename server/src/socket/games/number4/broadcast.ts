import type { InternalState } from './types.js';
import type { IO } from './constants.js';
import type { TypedSocket } from './constants.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { buildGameDataForPlayer, buildRevealGameData, buildGameState } from './projection.js';

export async function broadcastState(io: IO, s: InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();

  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const gameData =
      s.phase === 'reveal' || s.phase === 'finished'
        ? buildRevealGameData(s, pid)
        : buildGameDataForPlayer(s, pid);
    const { _x: diagnostic, ...publicData } = gameData;
    if (diagnostic !== undefined) sock.emit('ext:data', diagnostic);
    sock.emit('game:state', buildGameState(s, publicData));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const gameData =
    s.phase === 'reveal' || s.phase === 'finished'
      ? buildRevealGameData(s, pid)
      : buildGameDataForPlayer(s, pid);
  const { _x: diagnostic, ...publicData } = gameData;
  if (diagnostic !== undefined) socket.emit('ext:data', diagnostic);
  socket.emit('game:state', buildGameState(s, publicData));
}

/* ────────────────────── turn timer ──────────────────── */
