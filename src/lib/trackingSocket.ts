import { io, Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';

const ORIGIN = API_URL.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

export function getTrackingSocket(): Socket {
  if (socket) return socket;
  socket = io(`${ORIGIN}/tracking`, {
    path: '/socket.io',
    autoConnect: false,
    transports: ['websocket'],
  });
  return socket;
}

export function connectTrackingSocket(): Socket {
  const s = getTrackingSocket();
  s.auth = { token: getToken() };
  if (!s.connected) s.connect();
  return s;
}
