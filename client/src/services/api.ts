import axios from 'axios';
import { User, Message, Conversation, AuthResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
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
      // Clean return to login on expired or invalid token
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
      // Ignore network failure on logout
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
  }
};

export const usersAPI = {
  getAll: async (): Promise<User[]> => {
    const res = await api.get<User[]>('/users');
    return res.data;
  },

  getById: async (id: string): Promise<User> => {
    const res = await api.get<User>(`/users/${id}`);
    return res.data;
  }
};

export const messagesAPI = {
  getConversations: async (): Promise<Conversation[]> => {
    const res = await api.get<Conversation[]>('/conversations');
    return res.data;
  },

  getConversation: async (userId: string): Promise<Message[]> => {
    const res = await api.get<Message[]>(`/messages/${userId}`);
    return res.data;
  },

  send: async (data: { receiverId: string; content: string; clientMsgId?: string }): Promise<{ data: Message }> => {
    const res = await api.post<{ data: Message }>('/messages', data);
    return res.data;
  },

  markRead: async (senderId: string): Promise<void> => {
    await api.patch(`/messages/read/${senderId}`);
  }
};

export default api;
