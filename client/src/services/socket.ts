import { io, Socket } from 'socket.io-client';
import { Message } from '../types';

let socket: Socket | null = null;

export const initializeSocket = (token: string): Socket => {
  if (socket) {
    socket.disconnect();
  }

  // Use current window location or configured socket URL
  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

  socket = io(socketUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5, // Jitter
    transports: ['websocket', 'polling']
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const sendSocketMessage = (
  receiverId: string,
  content: string,
  clientMsgId: string
): Promise<{ success?: boolean; data?: Message; error?: string }> => {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      resolve({ error: 'Socket is not connected' });
      return;
    }

    socket.emit(
      'message:send',
      { receiverId, content, clientMsgId },
      (response: { success?: boolean; data?: Message; error?: string }) => {
        resolve(response || { success: true });
      }
    );
  });
};

export const sendSocketRead = (senderId: string): void => {
  if (socket && socket.connected) {
    socket.emit('message:read', { senderId });
  }
};

export const sendSocketTyping = (receiverId: string, isTyping: boolean): void => {
  if (socket && socket.connected) {
    socket.emit('typing', { receiverId, isTyping });
  }
};
