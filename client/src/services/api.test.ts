import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import api, { authAPI, usersAPI, messagesAPI } from './api';

const mockUser = { id: '1', username: 'testuser', fullName: 'Test User' };
const mockMessage = { id: 'msg1', senderId: '1', receiverId: '2', content: 'hello' };
const mockConversation = { userId: '2', lastMessage: mockMessage, unreadCount: 0 };

export const handlers = [
  http.post('*/api/register', async () => {
    return HttpResponse.json({ token: 'fake-token', user: mockUser });
  }),
  http.post('*/api/login', async () => {
    return HttpResponse.json({ token: 'fake-token', user: mockUser });
  }),
  http.post('*/api/logout', async () => {
    return HttpResponse.json({ success: true });
  }),
  http.get('*/api/me', async () => {
    return HttpResponse.json({ user: mockUser });
  }),
  http.patch('*/api/auth/profile', async () => {
    return HttpResponse.json({ user: { ...mockUser, avatarColor: '#000000' } });
  }),
  http.get('*/api/users', async () => {
    return HttpResponse.json([mockUser]);
  }),
  http.get('*/api/users/:id', async ({ params }) => {
    return HttpResponse.json({ ...mockUser, id: params.id as string });
  }),
  http.get('*/api/conversations', async () => {
    return HttpResponse.json([mockConversation]);
  }),
  http.get('*/api/messages/:userId', async () => {
    return HttpResponse.json([mockMessage]);
  }),
  http.post('*/api/messages', async () => {
    return HttpResponse.json({ data: mockMessage });
  }),
  http.patch('*/api/messages/read/:senderId', async () => {
    return HttpResponse.json({ success: true });
  })
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('usersAPI', () => {
  it('getAll should return array of users', async () => {
    const res = await usersAPI.getAll();
    expect(res).toEqual([mockUser]);
  });

  it('getById should return specific user', async () => {
    const res = await usersAPI.getById('99');
    expect(res).toEqual({ ...mockUser, id: '99' });
  });
});

describe('messagesAPI', () => {
  it('getConversations should return array of conversations', async () => {
    const res = await messagesAPI.getConversations();
    expect(res).toEqual([mockConversation]);
  });

  it('getConversation should return array of messages for specific user', async () => {
    const res = await messagesAPI.getConversation('2');
    expect(res).toEqual([mockMessage]);
  });

  it('send should post new message and return it', async () => {
    const res = await messagesAPI.send({ receiverId: '2', content: 'test msg' });
    expect(res.data).toEqual(mockMessage);
  });

  it('markRead should patch successfully', async () => {
    await expect(messagesAPI.markRead('1')).resolves.toBeUndefined();
  });
});
afterAll(() => server.close());

describe('API Interceptors', () => {
  it('should add Authorization header if token exists in localStorage', async () => {
    localStorage.setItem('token', 'my-auth-token');

    // We can observe the header on the mocked API response if we modify it to return headers,
    // or we can just spy on axios request or mock server's request object.
    // For simplicity, let's add a temporary endpoint that echoes headers.
    server.use(
      http.get('*/api/echo-headers', ({ request }) => {
        return HttpResponse.json({ auth: request.headers.get('Authorization') });
      })
    );

    const res = await api.get('/echo-headers');
    expect(res.data.auth).toBe('Bearer my-auth-token');
  });

  it('should clear localStorage on 401 response', async () => {
    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('user', JSON.stringify(mockUser));

    server.use(
      http.get('*/api/unauthorized', () => {
        return new HttpResponse(null, { status: 401 });
      })
    );

    await expect(api.get('/unauthorized')).rejects.toThrow();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});

describe('authAPI', () => {
  it('register should make post request and return data', async () => {
    const res = await authAPI.register({ username: 'testuser', password: 'password' });
    expect(res.token).toBe('fake-token');
    expect(res.user).toEqual(mockUser);
  });

  it('login should make post request and return data', async () => {
    const res = await authAPI.login({ username: 'testuser', password: 'password' });
    expect(res.token).toBe('fake-token');
    expect(res.user).toEqual(mockUser);
  });

  it('logout should call post request and remove user and token from localStorage', async () => {
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    await authAPI.logout();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('getMe should make get request and return data', async () => {
    const res = await authAPI.getMe();
    expect(res.user).toEqual(mockUser);
  });

  it('updateProfile should make patch request and return updated data', async () => {
    const res = await authAPI.updateProfile({ avatarColor: '#000000' });
    expect(res.user.avatarColor).toBe('#000000');
  });
});
