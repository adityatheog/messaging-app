import axios from 'axios';
import { User, Message, Conversation, AuthResponse, UploadedAttachment } from '../types';

const getBaseURL = (): string => {
  const envApiUrl = import.meta.env?.VITE_API_URL || '';
  if (envApiUrl) {
    return envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl.replace(/\/+$/, '')}/api`;
  }
  return '/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: async (data: { username: string; password: string; fullName?: string }): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/register', data);
    return res.data;
  },
  login: async (data: { username: string; password: string }): Promise<AuthResponse> => {
    const res = await api.post<AuthResponse>('/login', data);
    return res.data;
  },
  logout: async (): Promise<void> => {
    try {
      await api.post('/logout');
    } catch {
      // Clear local session state even if the network request fails.
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },
  getMe: async (): Promise<{ user: User }> => {
    const res = await api.get<{ user: User }>('/me');
    return res.data;
  },
  updateProfile: async (data: { fullName?: string; avatarColor?: string }): Promise<{ user: User }> => {
    const res = await api.patch<{ user: User }>('/auth/profile', data);
    return res.data;
  },
  deleteAccount: async (): Promise<void> => {
    await api.delete('/auth/account');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

export const usersAPI = {
  getAll: async (query?: string): Promise<User[]> => {
    const res = await api.get<User[]>('/users', {
      params: query ? { q: query } : undefined
    });
    return res.data;
  },
  getById: async (id: string): Promise<User> => {
    const res = await api.get<User>(`/users/${id}`);
    return res.data;
  },
  getContacts: async (): Promise<User[]> => {
    const res = await api.get<User[]>('/users/contacts');
    return res.data;
  },
  addContact: async (contactId: string): Promise<{ contact: User }> => {
    const res = await api.post<{ contact: User }>('/users/contacts', { contactId });
    return res.data;
  },
  removeContact: async (contactId: string): Promise<void> => {
    await api.delete(`/users/contacts/${contactId}`);
  }
};

export interface SendMessagePayload {
  receiverId: string;
  content: string;
  clientMsgId?: string;
  messageType?: Message['messageType'];
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  audioDurationSeconds?: number | null;
}

export const messagesAPI = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await api.get<Conversation[]>('/conversations');
    return res.data;
  },
  getConversation: async (
    userId: string,
    params?: { limit?: number; before?: string; after?: string }
  ): Promise<Message[]> => {
    const res = await api.get<Message[]>(`/messages/${userId}`, { params });
    return res.data;
  },
  send: async (data: SendMessagePayload): Promise<{ data: Message }> => {
    const res = await api.post<{ data: Message }>('/messages', data);
    return res.data;
  },
  markRead: async (senderId: string): Promise<void> => {
    await api.patch(`/messages/read/${senderId}`);
  }
};

export const uploadsAPI = {
  upload: async (data: {
    fileName: string;
    mimeType: string;
    dataBase64: string;
  }): Promise<{ attachment: UploadedAttachment }> => {
    const res = await api.post<{ attachment: UploadedAttachment }>('/uploads', data);
    return res.data;
  }
};

export default api;
