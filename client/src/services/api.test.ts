import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import api, { authAPI, usersAPI, messagesAPI, uploadsAPI } from './api';
import { User, Message, Conversation, UploadedAttachment } from '../types';

const mockUser: User = { id: '1', username: 'testuser', fullName: 'Test User' };
const mockMessage: Message = {
  id: 'msg1',
  senderId: '1',
  receiverId: '2',
  content: 'hello',
  timestamp: '2026-10-14T00:00:00.000Z',
  read: false
};
const mockConversation: Conversation = {
  user: { id: '2', username: 'peer', fullName: 'Peer User' },
  lastMessage: mockMessage,
  unreadCount: 0,
  updatedAt: '2026-10-14T00:00:00.000Z'
};
const mockAttachment: UploadedAttachment = {
  id: 'att1',
  uploaderId: '1',
  originalName: 'photo.png',
  storedName: 'att1.png',
  mimeType: 'image/png',
  sizeBytes: 68,
  createdAt: '2026-10-14T00:00:00.000Z',
  url: '/api/uploads/att1'
};

const originalAdapter = api.defaults.adapter;

const installMockAdapter = (
  handler?: (config: InternalAxiosRequestConfig) => { status?: number; data?: unknown }
) => {
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    const method = (config.method || 'get').toLowerCase();
    const url = config.url || '';

    if (handler) {
      const custom = handler(config);
      const status = custom.status ?? 200;
      if (status >= 400) {
        const err = new AxiosError(
          `Request failed with status code ${status}`,
          String(status),
          config,
          null,
          {
            data: custom.data,
            status,
            statusText: String(status),
            headers: new AxiosHeaders(),
            config
          }
        );
        throw err;
      }
      return {
        data: custom.data,
        status,
        statusText: 'OK',
        headers: new AxiosHeaders(),
        config
      };
    }

    let responseData: unknown = {};

    if (method === 'post' && url === '/register') {
      responseData = { message: 'User registered', token: 'fake-token', user: mockUser };
    } else if (method === 'post' && url === '/login') {
      responseData = { message: 'Login successful', token: 'fake-token', user: mockUser };
    } else if (method === 'post' && url === '/logout') {
      responseData = { message: 'Logged out' };
    } else if (method === 'delete' && url === '/auth/account') {
      responseData = { message: 'Account deleted' };
    } else if (method === 'get' && url === '/me') {
      responseData = { user: mockUser };
    } else if (method === 'patch' && url === '/auth/profile') {
      responseData = { user: { ...mockUser, avatarColor: '#000000' } };
    } else if (method === 'get' && url === '/users') {
      responseData = [mockUser];
    } else if (method === 'get' && url === '/users/contacts') {
      responseData = [mockUser];
    } else if (method === 'post' && url === '/users/contacts') {
      responseData = { contact: mockUser };
    } else if (method === 'delete' && url.startsWith('/users/contacts/')) {
      responseData = { message: 'Contact removed' };
    } else if (method === 'get' && url.startsWith('/users/')) {
      const id = url.slice('/users/'.length);
      responseData = { ...mockUser, id };
    } else if (method === 'get' && url === '/conversations') {
      responseData = [mockConversation];
    } else if (method === 'get' && url.startsWith('/messages/')) {
      responseData = [mockMessage];
    } else if (method === 'post' && url === '/messages') {
      responseData = { data: mockMessage };
    } else if (method === 'patch' && url.startsWith('/messages/read/')) {
      responseData = { message: 'Messages marked as read' };
    } else if (method === 'post' && url === '/uploads') {
      responseData = { attachment: mockAttachment };
    }

    return {
      data: responseData,
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config
    };
  };
};

beforeEach(() => {
  installMockAdapter();
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  localStorage.clear();
  vi.clearAllMocks();
});

describe('usersAPI', () => {
  it('getAll returns array of users', async () => {
    const res = await usersAPI.getAll();
    expect(res).toEqual([mockUser]);
  });

  it('getById returns specific user', async () => {
    const res = await usersAPI.getById('99');
    expect(res).toEqual({ ...mockUser, id: '99' });
  });

  it('getContacts, addContact, and removeContact manage contacts', async () => {
    const list = await usersAPI.getContacts();
    expect(list).toEqual([mockUser]);
    const added = await usersAPI.addContact('2');
    expect(added.contact).toEqual(mockUser);
    await expect(usersAPI.removeContact('2')).resolves.toBeUndefined();
  });
});

describe('messagesAPI and uploadsAPI', () => {
  it('getConversations returns array of conversations', async () => {
    const res = await messagesAPI.getConversations();
    expect(res).toEqual([mockConversation]);
  });

  it('getConversation returns array of messages for specific user', async () => {
    const res = await messagesAPI.getConversation('2', { limit: 50 });
    expect(res).toEqual([mockMessage]);
  });

  it('send posts new message and returns it', async () => {
    const res = await messagesAPI.send({ receiverId: '2', content: 'test msg' });
    expect(res.data).toEqual(mockMessage);
  });

  it('markRead patches successfully', async () => {
    await expect(messagesAPI.markRead('1')).resolves.toBeUndefined();
  });

  it('uploadsAPI.upload posts attachment and returns metadata', async () => {
    const res = await uploadsAPI.upload({
      fileName: 'photo.png',
      mimeType: 'image/png',
      dataBase64: 'iVBORw0KGgo='
    });
    expect(res.attachment).toEqual(mockAttachment);
  });
});

describe('API Interceptors', () => {
  it('adds Authorization header if token exists in localStorage', async () => {
    localStorage.setItem('token', 'my-auth-token');

    installMockAdapter((config) => ({
      status: 200,
      data: { auth: config.headers?.Authorization }
    }));

    const res = await api.get('/echo-headers');
    expect(res.data.auth).toBe('Bearer my-auth-token');
  });

  it('clears localStorage and dispatches auth:unauthorized on 401 response', async () => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    const eventSpy = vi.fn();
    window.addEventListener('auth:unauthorized', eventSpy);

    installMockAdapter(() => ({
      status: 401,
      data: { error: 'Unauthorized' }
    }));

    await expect(api.get('/unauthorized')).rejects.toThrow();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(eventSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:unauthorized', eventSpy);
  });
});

describe('authAPI', () => {
  it('register makes post request and returns data', async () => {
    const res = await authAPI.register({ username: 'testuser', password: 'password' });
    expect(res.token).toBe('fake-token');
    expect(res.user).toEqual(mockUser);
  });

  it('login makes post request and returns data', async () => {
    const res = await authAPI.login({ username: 'testuser', password: 'password' });
    expect(res.token).toBe('fake-token');
    expect(res.user).toEqual(mockUser);
  });

  it('logout calls post request and removes user and token from localStorage', async () => {
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    await authAPI.logout();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('deleteAccount deletes account and clears localStorage', async () => {
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    await authAPI.deleteAccount();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('getMe makes get request and returns data', async () => {
    const res = await authAPI.getMe();
    expect(res.user).toEqual(mockUser);
  });

  it('updateProfile makes patch request and returns updated data', async () => {
    const res = await authAPI.updateProfile({ avatarColor: '#000000' });
    expect(res.user.avatarColor).toBe('#000000');
  });
});
