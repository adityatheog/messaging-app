import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Message, Conversation } from '../types';
import { usersAPI, messagesAPI } from '../services/api';
import {
  initializeSocket,
  getSocket,
  disconnectSocket,
  sendSocketMessage,
  sendSocketRead,
  sendSocketTyping
} from '../services/socket';
import { offlineQueue } from '../services/offlineQueue';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { AttachmentMetadata } from '../components/Chat/MessageInput';
import { WifiOff, RefreshCw } from 'lucide-react';

const PAGE_LIMIT = 50;

export const ChatApp: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState<boolean>(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState<boolean>(false);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const mountedRef = useRef<boolean>(true);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUserRef = useRef<User | null>(null);
  const fetchingDirectoryRef = useRef<boolean>(false);
  const fetchingMessagesRef = useRef<boolean>(false);
  const flushingQueueRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchDirectory = useCallback(async () => {
    if (fetchingDirectoryRef.current || !mountedRef.current) return;
    fetchingDirectoryRef.current = true;
    try {
      const [userList, convList] = await Promise.all([
        usersAPI.getAll(),
        messagesAPI.getConversations()
      ]);
      if (mountedRef.current) {
        setUsers(userList);
        setConversations(convList);
      }
    } catch (err) {
      console.error('Failed to fetch directory data:', err);
    } finally {
      fetchingDirectoryRef.current = false;
    }
  }, []);

  const fetchMessagesForUser = useCallback(
    async (peerId: string) => {
      if (!user || fetchingMessagesRef.current || !mountedRef.current) return;
      fetchingMessagesRef.current = true;
      try {
        const data = await messagesAPI.getConversation(peerId, { limit: PAGE_LIMIT });
        if (!mountedRef.current || selectedUserRef.current?.id !== peerId) return;

        setHasOlderMessages(data.length >= PAGE_LIMIT);
        setMessages(() => {
          const pendingForThisChat = offlineQueue
            .getQueue(user.id)
            .filter((q) => q.receiverId === peerId)
            .map((q) => ({
              id: q.clientMsgId,
              clientMsgId: q.clientMsgId,
              senderId: q.senderId,
              receiverId: q.receiverId,
              content: q.content,
              timestamp: q.timestamp,
              read: false,
              status: q.status
            }));

          const existingIds = new Set(data.map((m) => m.id));
          const existingClientIds = new Set(
            data.map((m) => m.clientMsgId).filter((id): id is string => Boolean(id))
          );
          const filteredPending = pendingForThisChat.filter(
            (p) => !existingIds.has(p.id) && !existingClientIds.has(p.clientMsgId)
          );

          return [...data, ...filteredPending];
        });

        const hasUnreadFromPeer = data.some((m) => m.senderId === peerId && !m.read);
        if (hasUnreadFromPeer) {
          const socket = getSocket();
          if (socket && socket.connected) {
            sendSocketRead(peerId);
          } else {
            await messagesAPI.markRead(peerId);
          }
        }
      } catch (err) {
        console.error('Failed to fetch conversation:', err);
      } finally {
        fetchingMessagesRef.current = false;
      }
    },
    [user]
  );

  const handleLoadOlderMessages = async () => {
    if (!selectedUser || loadingOlderMessages || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest || !oldest.id) return;

    const peerId = selectedUser.id;
    setLoadingOlderMessages(true);
    try {
      const older = await messagesAPI.getConversation(peerId, {
        before: oldest.id,
        limit: PAGE_LIMIT
      });
      if (!mountedRef.current || selectedUserRef.current?.id !== peerId) return;
      setHasOlderMessages(older.length >= PAGE_LIMIT);
      if (older.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const uniqueOlder = older.filter((m) => !existingIds.has(m.id));
          return [...uniqueOlder, ...prev];
        });
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      if (mountedRef.current) {
        setLoadingOlderMessages(false);
      }
    }
  };

  const flushOfflineQueue = useCallback(async () => {
    if (!user || flushingQueueRef.current || !mountedRef.current) return;
    const queue = offlineQueue.getQueue(user.id);
    if (queue.length === 0) return;

    flushingQueueRef.current = true;
    try {
      for (const item of queue) {
        if (!mountedRef.current) break;
        try {
          const res = await messagesAPI.send({
            receiverId: item.receiverId,
            content: item.content,
            clientMsgId: item.clientMsgId
          });

          offlineQueue.remove(user.id, item.clientMsgId);

          if (mountedRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.clientMsgId === item.clientMsgId || m.id === item.clientMsgId
                  ? { ...res.data, status: 'sent' }
                  : m
              )
            );
          }
        } catch (err) {
          console.error('Failed to flush offline message:', err);
          offlineQueue.updateStatus(user.id, item.clientMsgId, 'failed');
          break;
        }
      }
      if (mountedRef.current) {
        fetchDirectory();
      }
    } finally {
      flushingQueueRef.current = false;
    }
  }, [user, fetchDirectory]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    const socket = initializeSocket(token);

    socket.on('connect', () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      setIsReconnecting(false);
      flushOfflineQueue();
      fetchDirectory();
      const activePeer = selectedUserRef.current;
      if (activePeer) {
        fetchMessagesForUser(activePeer.id);
      }
    });

    socket.on('disconnect', () => {
      if (mountedRef.current) {
        setIsConnected(false);
      }
    });

    socket.on('connect_error', () => {
      if (mountedRef.current) {
        setIsConnected(false);
        setIsReconnecting(true);
      }
    });

    socket.on('message:new', ({ message }: { message: Message }) => {
      if (!mountedRef.current) return;
      const activePeer = selectedUserRef.current;
      if (
        activePeer &&
        (message.senderId === activePeer.id || message.receiverId === activePeer.id)
      ) {
        setMessages((prev) => {
          const existingIdx = prev.findIndex(
            (m) =>
              (message.clientMsgId && m.clientMsgId === message.clientMsgId) || m.id === message.id
          );
          if (existingIdx !== -1) {
            const next = [...prev];
            next[existingIdx] = { ...next[existingIdx], ...message, status: 'sent' };
            return next;
          }
          return [...prev, { ...message, status: 'sent' }];
        });

        if (message.senderId === activePeer.id) {
          sendSocketRead(activePeer.id);
        }
      }

      fetchDirectory();
    });

    socket.on('message:delivered', ({ messageId }: { messageId: string }) => {
      if (!mountedRef.current) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, delivered: true, status: 'delivered' } : m))
      );
    });

    socket.on('message:read', ({ senderId, readerId }: { senderId: string; readerId: string }) => {
      if (!mountedRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === senderId && m.receiverId === readerId
            ? { ...m, read: true, status: 'read' }
            : m
        )
      );
      fetchDirectory();
    });

    socket.on(
      'typing',
      ({ senderId, isTyping: typingStatus }: { senderId: string; isTyping: boolean }) => {
        if (!mountedRef.current) return;
        const activePeer = selectedUserRef.current;
        if (activePeer && senderId === activePeer.id) {
          setIsTyping(typingStatus);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (typingStatus) {
            typingTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setIsTyping(false);
              }
            }, 3000);
          }
        }
      }
    );

    socket.on('presence', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      if (!mountedRef.current) return;
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isOnline } : u)));
      setConversations((prev) =>
        prev.map((c) => (c.user.id === userId ? { ...c, user: { ...c.user, isOnline } } : c))
      );
      setSelectedUser((prev) => (prev && prev.id === userId ? { ...prev, isOnline } : prev));
    });

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      disconnectSocket();
    };
  }, [user, flushOfflineQueue, fetchDirectory, fetchMessagesForUser]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDirectory();
        if (selectedUserRef.current) {
          fetchMessagesForUser(selectedUserRef.current.id);
        }
        flushOfflineQueue();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', flushOfflineQueue);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', flushOfflineQueue);
    };
  }, [fetchDirectory, fetchMessagesForUser, flushOfflineQueue]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  useEffect(() => {
    if (isConnected) return;
    const interval = setInterval(() => {
      fetchDirectory();
      if (selectedUserRef.current) {
        fetchMessagesForUser(selectedUserRef.current.id);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchDirectory, fetchMessagesForUser, isConnected]);

  const selectedUserId = selectedUser?.id || null;
  useEffect(() => {
    if (!selectedUserId) {
      setMessages([]);
      setHasOlderMessages(false);
      setLoadingMessages(false);
      return;
    }

    let cancelled = false;
    setIsTyping(false);
    setLoadingMessages(true);
    fetchMessagesForUser(selectedUserId).finally(() => {
      if (!cancelled && mountedRef.current) {
        setLoadingMessages(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedUserId, fetchMessagesForUser]);

  const handleSelectUser = (targetUser: User) => {
    setSelectedUser(targetUser);
  };

  const handleSendMessage = async (
    content: string,
    type?: Message['messageType'],
    mediaName?: string,
    attachment?: AttachmentMetadata
  ): Promise<boolean> => {
    if (!selectedUser || !content.trim() || !user) return false;

    const cleanContent = content.trim();
    const msgType = type || 'TEXT';
    const queued = offlineQueue.enqueue(user.id, selectedUser.id, cleanContent);
    const optimisticMessage: Message = {
      id: queued.clientMsgId,
      clientMsgId: queued.clientMsgId,
      senderId: user.id,
      receiverId: selectedUser.id,
      content: cleanContent,
      timestamp: queued.timestamp,
      read: false,
      status: 'pending',
      messageType: msgType,
      mediaName: attachment?.mediaName || mediaName,
      mediaUrl: attachment?.mediaUrl || null,
      mediaSize: attachment?.mediaSize ?? null,
      audioDurationSeconds: attachment?.audioDurationSeconds ?? null
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const socket = getSocket();
    if (socket && socket.connected) {
      try {
        const res = await sendSocketMessage(selectedUser.id, cleanContent, queued.clientMsgId, {
          messageType: msgType,
          mediaUrl: optimisticMessage.mediaUrl,
          mediaName: optimisticMessage.mediaName,
          mediaSize: optimisticMessage.mediaSize,
          audioDurationSeconds: optimisticMessage.audioDurationSeconds
        });
        if (res.data) {
          offlineQueue.remove(user.id, queued.clientMsgId);
          if (mountedRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.clientMsgId === queued.clientMsgId
                  ? {
                      ...optimisticMessage,
                      ...res.data!,
                      status: 'sent'
                    }
                  : m
              )
            );
            fetchDirectory();
          }
          return true;
        }
      } catch {
        // Fall through to the HTTP send path when socket ack fails.
      }
    }

    try {
      const res = await messagesAPI.send({
        receiverId: selectedUser.id,
        content: cleanContent,
        clientMsgId: queued.clientMsgId,
        messageType: msgType,
        mediaUrl: optimisticMessage.mediaUrl,
        mediaName: optimisticMessage.mediaName,
        mediaSize: optimisticMessage.mediaSize,
        audioDurationSeconds: optimisticMessage.audioDurationSeconds
      });

      offlineQueue.remove(user.id, queued.clientMsgId);
      if (mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === queued.clientMsgId
              ? { ...optimisticMessage, ...res.data, status: 'sent' }
              : m
          )
        );
        fetchDirectory();
      }
      return true;
    } catch (err) {
      console.warn('Message queued offline:', err);
      offlineQueue.updateStatus(user.id, queued.clientMsgId, 'failed');
      if (mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) => (m.clientMsgId === queued.clientMsgId ? { ...m, status: 'failed' } : m))
        );
      }
      return false;
    }
  };

  const handleRetryMessage = async (msg: Message) => {
    if (!selectedUser || !user) return;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'pending' } : m)));

    try {
      const res = await messagesAPI.send({
        receiverId: selectedUser.id,
        content: msg.content,
        clientMsgId: msg.clientMsgId || undefined,
        messageType: msg.messageType,
        mediaUrl: msg.mediaUrl,
        mediaName: msg.mediaName,
        mediaSize: msg.mediaSize,
        audioDurationSeconds: msg.audioDurationSeconds
      });

      if (msg.clientMsgId) {
        offlineQueue.remove(user.id, msg.clientMsgId);
      }

      if (mountedRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id
              ? {
                  ...msg,
                  ...res.data,
                  status: 'sent'
                }
              : m
          )
        );
        fetchDirectory();
      }
    } catch {
      if (mountedRef.current) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' } : m)));
      }
    }
  };

  const handleTyping = (typingState: boolean) => {
    if (selectedUser) {
      sendSocketTyping(selectedUser.id, typingState);
    }
  };

  if (!user) return null;

  return (
    <div className="d-flex flex-column h-100 position-relative">
      {(!isConnected || isReconnecting) && (
        <div
          className="bg-warning text-dark py-2 px-3 text-center small font-weight-bold d-flex align-items-center justify-content-center shadow-sm"
          style={{ zIndex: 1040, backgroundColor: '#d29922' }}
        >
          {isReconnecting ? (
            <>
              <RefreshCw size={14} className="mr-2 spinner-border spinner-border-sm border-0" />
              Connecting...
            </>
          ) : (
            <>
              <WifiOff size={14} className="mr-2" />
              You are offline. Reconnecting automatically.
            </>
          )}
        </div>
      )}

      <div className="app-container flex-grow-1">
        {(!isMobile || !selectedUser) && (
          <Sidebar
            conversations={conversations}
            users={users}
            selectedUser={selectedUser}
            onSelectUser={handleSelectUser}
          />
        )}

        {(!isMobile || selectedUser) && (
          <ChatWindow
            selectedUser={selectedUser}
            messages={messages}
            currentUserId={user.id}
            isTyping={isTyping}
            hasOlderMessages={hasOlderMessages}
            loadingOlderMessages={loadingOlderMessages}
            onLoadOlderMessages={handleLoadOlderMessages}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            onRetryMessage={handleRetryMessage}
            onBackToList={() => setSelectedUser(null)}
            loadingMessages={loadingMessages}
          />
        )}
      </div>
    </div>
  );
};
