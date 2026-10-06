import { io, Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';

// The backend's /chat Socket.IO namespace lives on the same host as the
// REST API (custom server.js attaches socket.io to the same Next.js HTTP
// server) -- just strip the "/api" suffix to get the socket origin.
const ORIGIN = API_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

// One shared connection for the whole app, not per screen.
export function getChatSocket(): Socket {
  if (socket) return socket;
  socket = io(`${ORIGIN}/chat`, {
    path: '/socket.io',
    autoConnect: false,
    // Engine.IO's long-polling transport doesn't behave well against RN's
    // XHR implementation on some Android devices -- websocket-only avoids
    // that entirely and this backend's nginx config already supports the
    // upgrade.
    transports: ['websocket'],
  });
  return socket;
}

export function connectChatSocket(): Socket {
  const s = getChatSocket();
  s.auth = { token: getToken() };
  if (!s.connected) s.connect();
  return s;
}
