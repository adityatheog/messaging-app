export interface QueuedMessage {
  clientMsgId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  status: 'pending' | 'failed';
}

const getQueueKey = (userId: string) => `messaging_offline_queue_${userId}`;

export const offlineQueue = {
  getQueue: (userId: string): QueuedMessage[] => {
    try {
      const raw = localStorage.getItem(getQueueKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  enqueue: (userId: string, receiverId: string, content: string): QueuedMessage => {
    const clientMsgId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const msg: QueuedMessage = {
      clientMsgId,
      senderId: userId,
      receiverId,
      content,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    const current = offlineQueue.getQueue(userId);
    const next = [...current, msg];
    localStorage.setItem(getQueueKey(userId), JSON.stringify(next));
    return msg;
  },

  remove: (userId: string, clientMsgId: string): void => {
    const current = offlineQueue.getQueue(userId);
    const next = current.filter((m) => m.clientMsgId !== clientMsgId);
    localStorage.setItem(getQueueKey(userId), JSON.stringify(next));
  },

  updateStatus: (userId: string, clientMsgId: string, status: 'pending' | 'failed'): void => {
    const current = offlineQueue.getQueue(userId);
    const next = current.map((m) => (m.clientMsgId === clientMsgId ? { ...m, status } : m));
    localStorage.setItem(getQueueKey(userId), JSON.stringify(next));
  },

  clearQueue: (userId: string): void => {
    localStorage.removeItem(getQueueKey(userId));
  }
};
