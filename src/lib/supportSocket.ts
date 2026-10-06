import { io, Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';

const ORIGIN = API_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

export function getSupportSocket(): Socket {
  if (socket) return socket;
  socket = io(`${ORIGIN}/support`, {
    path: '/socket.io',
    autoConnect: false,
    transports: ['websocket'],
  });
  return socket;
}

export function connectSupportSocket(): Socket {
  const s = getSupportSocket();
  s.auth = { token: getToken() };
  if (!s.connected) s.connect();
  return s;
}
