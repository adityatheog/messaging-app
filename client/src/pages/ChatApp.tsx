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
import { offlineQueue, QueuedMessage } from '../services/offlineQueue';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { WifiOff, RefreshCw } from 'lucide-react';

export const ChatApp: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768);

  // Connection & Typing state
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch directory & conversations
  const fetchDirectory = useCallback(async () => {
    try {
      const [userList, convList] = await Promise.all([
        usersAPI.getAll(),
        messagesAPI.getConversations()
      ]);
      setUsers(userList);
      setConversations(convList);
    } catch (err) {
      console.error('Failed to fetch directory data:', err);
    }
  }, []);

  // Fetch messages for active conversation
  const fetchActiveMessages = useCallback(async () => {
    if (!selectedUser) return;
    try {
      const data = await messagesAPI.getConversation(selectedUser.id);
      setMessages((prev) => {
        // Merge with any local pending messages in queue
        const pendingForThisChat = offlineQueue
          .getQueue(user!.id)
          .filter((q) => q.receiverId === selectedUser.id)
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
        const filteredPending = pendingForThisChat.filter((p) => !existingIds.has(p.id));

        return [...data, ...filteredPending];
      });

      // Mark read over socket and REST
      sendSocketRead(selectedUser.id);
      await messagesAPI.markRead(selectedUser.id);
    } catch (err) {
      console.error('Failed to fetch conversation:', err);
    }
  }, [selectedUser, user]);

  // Flush offline message queue
  const flushOfflineQueue = useCallback(async () => {
    if (!user) return;
    const queue = offlineQueue.getQueue(user.id);
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        const res = await messagesAPI.send({
          receiverId: item.receiverId,
          content: item.content,
          clientMsgId: item.clientMsgId
        });

        offlineQueue.remove(user.id, item.clientMsgId);

        // Update local message list
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === item.clientMsgId || m.id === item.clientMsgId
              ? { ...res.data, status: 'sent' }
              : m
          )
        );
      } catch (err) {
        console.error('Failed to flush offline message:', err);
        offlineQueue.updateStatus(user.id, item.clientMsgId, 'failed');
        break; // Preserve message ordering
      }
    }
    fetchDirectory();
  }, [user, fetchDirectory]);

  // Socket.IO Setup
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    const socket = initializeSocket(token);

    socket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      flushOfflineQueue();
      fetchDirectory();
      if (selectedUser) fetchActiveMessages();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
      setIsReconnecting(true);
    });

    socket.on('message:new', ({ message }: { message: Message }) => {
      if (
        selectedUser &&
        (message.senderId === selectedUser.id || message.receiverId === selectedUser.id)
      ) {
        setMessages((prev) => {
          // Replace matching pending message or append
          const existingIdx = prev.findIndex(
            (m) => (message.clientMsgId && m.clientMsgId === message.clientMsgId) || m.id === message.id
          );
          if (existingIdx !== -1) {
            const next = [...prev];
            next[existingIdx] = { ...message, status: 'sent' };
            return next;
          }
          return [...prev, { ...message, status: 'sent' }];
        });

        if (message.senderId === selectedUser.id) {
          sendSocketRead(selectedUser.id);
        }
      }

      fetchDirectory();
    });

    socket.on('message:delivered', ({ messageId, deliveredTo }: { messageId: string; deliveredTo: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, delivered: true, status: 'delivered' } : m))
      );
    });

    socket.on('message:read', ({ senderId, readerId }: { senderId: string; readerId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === senderId && m.receiverId === readerId ? { ...m, read: true, status: 'read' } : m
        )
      );
      fetchDirectory();
    });

    socket.on('typing', ({ senderId, isTyping: typingStatus }: { senderId: string; isTyping: boolean }) => {
      if (selectedUser && senderId === selectedUser.id) {
        setIsTyping(typingStatus);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (typingStatus) {
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
      }
    });

    socket.on('presence', ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isOnline } : u))
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.user.id === userId ? { ...c, user: { ...c.user, isOnline } } : c
        )
      );
      if (selectedUser?.id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, isOnline } : prev));
      }
    });

    return () => {
      disconnectSocket();
    };
  }, [user, selectedUser, flushOfflineQueue, fetchDirectory, fetchActiveMessages]);

  // App resume & visibility change handling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDirectory();
        if (selectedUser) fetchActiveMessages();
        flushOfflineQueue();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', flushOfflineQueue);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', flushOfflineQueue);
    };
  }, [fetchDirectory, fetchActiveMessages, flushOfflineQueue, selectedUser]);

  // Initial fetch and fallback polling
  useEffect(() => {
    fetchDirectory();
    const interval = setInterval(() => {
      if (!isConnected) {
        fetchDirectory();
        if (selectedUser) fetchActiveMessages();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchDirectory, fetchActiveMessages, isConnected, selectedUser]);

  // Load conversation when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      setIsTyping(false);
      setLoadingMessages(true);
      fetchActiveMessages().finally(() => setLoadingMessages(false));
    } else {
      setMessages([]);
    }
  }, [selectedUser, fetchActiveMessages]);

  const handleSelectUser = (targetUser: User) => {
    setSelectedUser(targetUser);
  };

  const handleSendMessage = async (content: string, type?: string, mediaName?: string): Promise<boolean> => {
    if (!selectedUser || !content.trim()) return false;

    const queued = offlineQueue.enqueue(user!.id, selectedUser.id, content.trim());
    const optimisticMessage: Message = {
      id: queued.clientMsgId,
      clientMsgId: queued.clientMsgId,
      senderId: user!.id,
      receiverId: selectedUser.id,
      content: content.trim(),
      timestamp: queued.timestamp,
      read: false,
      status: 'pending',
      messageType: (type as any) || 'TEXT',
      mediaName: mediaName
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Send over socket if connected, or fallback to REST
    const socket = getSocket();
    if (socket && socket.connected) {
      try {
        const res = await sendSocketMessage(selectedUser.id, content.trim(), queued.clientMsgId);
        if (res.data) {
          offlineQueue.remove(user!.id, queued.clientMsgId);
          setMessages((prev) =>
            prev.map((m) => (m.clientMsgId === queued.clientMsgId ? { ...res.data!, status: 'sent', messageType: (type as any) || 'TEXT', mediaName } : m))
          );
          fetchDirectory();
          return true;
        }
      } catch {
        // Fall back to REST below
      }
    }

    // REST fallback or offline handling
    try {
      const res = await messagesAPI.send({
        receiverId: selectedUser.id,
        content: content.trim(),
        clientMsgId: queued.clientMsgId
      });

      offlineQueue.remove(user!.id, queued.clientMsgId);
      setMessages((prev) =>
        prev.map((m) => (m.clientMsgId === queued.clientMsgId ? { ...res.data, status: 'sent', messageType: (type as any) || 'TEXT', mediaName } : m))
      );
      fetchDirectory();
      return true;
    } catch (err) {
      console.warn('Network issue; message held in offline queue:', err);
      offlineQueue.updateStatus(user!.id, queued.clientMsgId, 'failed');
      setMessages((prev) =>
        prev.map((m) => (m.clientMsgId === queued.clientMsgId ? { ...m, status: 'failed' } : m))
      );
      return false;
    }
  };

  const handleRetryMessage = async (msg: Message) => {
    if (!selectedUser) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: 'pending' } : m))
    );

    try {
      const res = await messagesAPI.send({
        receiverId: selectedUser.id,
        content: msg.content,
        clientMsgId: msg.clientMsgId || undefined
      });

      if (msg.clientMsgId) {
        offlineQueue.remove(user!.id, msg.clientMsgId);
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...res.data, status: 'sent' } : m))
      );
      fetchDirectory();
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' } : m))
      );
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
      {/* Offline / Reconnecting Banner */}
      {(!isConnected || isReconnecting) && (
        <div
          className="bg-warning text-white py-2 px-3 text-center small font-weight-bold d-flex align-items-center justify-content-center shadow-sm"
          style={{ zIndex: 1040 }}
        >
          {isReconnecting ? (
            <>
              <RefreshCw size={14} className="mr-2 spinner-border spinner-border-sm border-0" />
              Reconnecting to real-time service...
            </>
          ) : (
            <>
              <WifiOff size={14} className="mr-2" />
              Offline mode — pending messages will be sent automatically when reconnected
            </>
          )}
        </div>
      )}

      <div className="app-container flex-grow-1">
        {/* Sidebar */}
        {(!isMobile || !selectedUser) && (
          <Sidebar
            conversations={conversations}
            users={users}
            selectedUser={selectedUser}
            onSelectUser={handleSelectUser}
          />
        )}

        {/* Chat Window */}
        {(!isMobile || selectedUser) && (
          <ChatWindow
            selectedUser={selectedUser}
            messages={messages}
            currentUserId={user.id}
            isTyping={isTyping}
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
