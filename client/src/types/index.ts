export interface User {
  id: string;
  username: string;
  fullName: string;
  avatarColor?: string;
  isOnline?: boolean;
  createdAt?: string;
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
