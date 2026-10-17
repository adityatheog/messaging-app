export interface User {
  id: string;
  username: string;
  fullName: string;
  avatarColor?: string;
  isOnline?: boolean;
  createdAt?: string;
  lastSeen?: string;
  isVerified?: boolean;
  isBlocked?: boolean;
  safetyNumber?: string;
  pairwiseQueueAddress?: string;
  disappearingTimerSeconds?: number;
}

export interface Message {
  id: string;
  conversationId?: string;
  clientMsgId?: string | null;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  readAt?: string | null;
  delivered?: boolean;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  isGroup?: boolean;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToSender?: string | null;
  messageType?: 'TEXT' | 'IMAGE' | 'VOICE' | 'DOCUMENT';
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  audioDurationSeconds?: number | null;
  reactions?: Record<string, string[]>;
  isEdited?: boolean;
  disappearingAfterSeconds?: number;
}

export interface Conversation {
  user: User;
  lastMessage: Message;
  unreadCount: number;
  updatedAt: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface UploadedAttachment {
  id: string;
  uploaderId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}
