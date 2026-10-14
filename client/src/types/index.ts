export interface User {
  id: string;
  username: string;
  fullName: string;
  avatarColor?: string;
  isOnline?: boolean;
  createdAt?: string;
  isVerified?: boolean;
  isBlocked?: boolean;
  safetyNumber?: string;
  pairwiseQueueAddress?: string;
  disappearingTimerSeconds?: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  avatarColor?: string;
  memberIds: string[];
  adminIds: string[];
  createdAt: string;
  lastMessage?: Message;
  unreadCount?: number;
}

export interface ConnectionInvitation {
  id: string;
  inviterId: string;
  inviterName: string;
  inviterUsername: string;
  inviteCode: string;
  inviteUri: string;
  createdAt: string;
  status: 'active' | 'accepted' | 'expired';
}

export interface Message {
  id: string;
  clientMsgId?: string | null;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
  delivered?: boolean;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  isGroup?: boolean;
  replyToId?: string | null;
  replyToText?: string | null;
  replyToSender?: string | null;
  messageType?: 'TEXT' | 'IMAGE' | 'VOICE' | 'DOCUMENT';
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaSize?: number;
  audioDurationSeconds?: number;
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
