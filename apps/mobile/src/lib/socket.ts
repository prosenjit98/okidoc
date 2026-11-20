import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { session } from './api';
import { API_URL } from './config';

let socket: Socket | null = null;
let socketToken: string | undefined;

/**
 * Rooms and listeners live here, not on a particular socket, because:
 *  - several mounted screens share a room (Queue, Doctors and the clinic info hook all use clinic:<id>);
 *    a room is left only when the last of them unmounts, so closing one screen does not stop live
 *    updates for the others;
 *  - the socket is recreated when the access token changes, and the new socket must get every room
 *    and listener back.
 */
const rooms = new Map<string, number>();
const listeners = new Set<{ event: string; fn: (payload: unknown) => void }>();

function getSocket(): Socket {
  const token = session.get()?.accessToken;
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socketToken = token;
    const s = io(API_URL, { transports: ['websocket'], auth: token ? { token } : {}, reconnection: true, reconnectionDelay: 1500 });
    // (Re)join every room still in use on each connect, including reconnects after a network drop.
    s.on('connect', () => {
      for (const room of rooms.keys()) s.emit('subscribe', { room });
    });
    for (const l of listeners) s.on(l.event, l.fn);
    socket = s;
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

function retainRoom(room: string) {
  const n = (rooms.get(room) ?? 0) + 1;
  rooms.set(room, n);
  const s = getSocket();
  if (n === 1 && s.connected) s.emit('subscribe', { room });
  return () => {
    const left = (rooms.get(room) ?? 1) - 1;
    if (left > 0) {
      rooms.set(room, left);
      return;
    }
    rooms.delete(room);
    if (socket?.connected) socket.emit('unsubscribe', { room });
  };
}

function listen(event: string, fn: (payload: unknown) => void) {
  const l = { event, fn };
  listeners.add(l);
  getSocket().on(event, fn);
  return () => {
    listeners.delete(l);
    socket?.off(event, fn);
  };
}

/** Join a realtime room (instance:<id> | clinic:<id>) and receive events (NFR-01). */
export function useRoom(room: string | null | undefined, events: string[], onEvent: (event: string, payload: any) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const key = events.join(',');
  useEffect(() => {
    if (!room) return;
    const release = retainRoom(room);
    const offs = events.map((e) => listen(e, (p) => handler.current(e, p)));
    return () => {
      for (const off of offs) off();
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, key]);
}

/** Personal events (notifications) — the server auto-joins user:<id> for authenticated sockets. */
export function useUserEvents(enabled: boolean, onEvent: (event: string, payload: any) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  useEffect(() => {
    if (!enabled) return;
    return listen('notification', (p) => handler.current('notification', p));
  }, [enabled]);
}
