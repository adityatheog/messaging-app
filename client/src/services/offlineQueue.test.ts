import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { offlineQueue } from './offlineQueue';

describe('offlineQueue', () => {
  const userId = 'user-123';
  const receiverId = 'receiver-456';
  const content = 'Hello world';
  const queueKey = `messaging_offline_queue_${userId}`;

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('getQueue should return an empty array initially', () => {
    const queue = offlineQueue.getQueue(userId);
    expect(queue).toEqual([]);
  });

  it('getQueue should handle invalid JSON gracefully', () => {
    localStorage.setItem(queueKey, 'invalid-json');
    const queue = offlineQueue.getQueue(userId);
    expect(queue).toEqual([]);
  });

  it('enqueue should add a message to the queue', () => {
    const msg = offlineQueue.enqueue(userId, receiverId, content);

    expect(msg.senderId).toBe(userId);
    expect(msg.receiverId).toBe(receiverId);
    expect(msg.content).toBe(content);
    expect(msg.status).toBe('pending');
    expect(msg.clientMsgId).toMatch(/^offline-\d+-[a-z0-9]{6}$/);
    expect(msg.timestamp).toBe('2024-01-01T00:00:00.000Z');

    const queue = offlineQueue.getQueue(userId);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toEqual(msg);

    const stored = JSON.parse(localStorage.getItem(queueKey) || '[]');
    expect(stored).toEqual([msg]);
  });

  it('enqueue should append to existing messages', () => {
    offlineQueue.enqueue(userId, receiverId, 'First message');
    offlineQueue.enqueue(userId, receiverId, 'Second message');

    const queue = offlineQueue.getQueue(userId);
    expect(queue).toHaveLength(2);
    expect(queue[0].content).toBe('First message');
    expect(queue[1].content).toBe('Second message');
  });

  it('updateStatus should update the status of an existing message', () => {
    const msg = offlineQueue.enqueue(userId, receiverId, content);

    offlineQueue.updateStatus(userId, msg.clientMsgId, 'failed');

    const queue = offlineQueue.getQueue(userId);
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe('failed');
  });

  it('remove should remove a specific message by clientMsgId', () => {
    const msg1 = offlineQueue.enqueue(userId, receiverId, 'Msg 1');
    const msg2 = offlineQueue.enqueue(userId, receiverId, 'Msg 2');

    expect(offlineQueue.getQueue(userId)).toHaveLength(2);

    offlineQueue.remove(userId, msg1.clientMsgId);

    const queue = offlineQueue.getQueue(userId);
    expect(queue).toHaveLength(1);
    expect(queue[0].clientMsgId).toBe(msg2.clientMsgId);
  });

  it('clearQueue should remove the queue entirely from localStorage', () => {
    offlineQueue.enqueue(userId, receiverId, content);
    expect(localStorage.getItem(queueKey)).toBeTruthy();

    offlineQueue.clearQueue(userId);

    expect(localStorage.getItem(queueKey)).toBeNull();
    expect(offlineQueue.getQueue(userId)).toEqual([]);
  });
});
