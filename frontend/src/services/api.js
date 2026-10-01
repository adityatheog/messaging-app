import axios from 'axios';

// Base API URL. REACT_APP_API_URL is read at BUILD time (Create React App inlines it),
// so it must be present when `npm run build` runs. Defaults to the same-origin /api
// (CRA dev proxy in development, nginx proxy in Docker).
const API_URL = (process.env.REACT_APP_API_URL || '/api').replace(/\/+$/, '');

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  // Without a timeout an unreachable/cold-starting backend leaves the app on its loading spinner
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// AuthContext registers a callback here so an expired/invalid token resets React
// state too (not just localStorage) without a full page reload.
let unauthorizedHandler = null;
export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    // A 401 from /login or /register just means "wrong credentials": the page must stay
    // put so the error message can be shown (the old code reloaded the page here).
    const isCredentialRequest = /\/(login|register)$/.test(url);
    // Only treat it as a dead session if the rejected request used the token we still hold
    // (ignores late 401s from a previous session, e.g. right after logging out/in).
    const sentHeaders = error.config?.headers;
    const sentAuth =
      sentHeaders && typeof sentHeaders.get === 'function'
        ? sentHeaders.get('Authorization')
        : sentHeaders?.Authorization;
    const currentToken = localStorage.getItem('token');
    const wasCurrentSession = Boolean(currentToken) && sentAuth === `Bearer ${currentToken}`;

    if (status === 401 && !isCredentialRequest && wasCurrentSession) {
      // Token expired or invalid - clear storage and reset auth state
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (unauthorizedHandler) {
        unauthorizedHandler();
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/register', userData);
    return response.data;
  },
  
  login: async (credentials) => {
    const response = await api.post('/login', credentials);
    return response.data;
  },

  // Validates the stored token and returns the current user record
  me: async () => {
    const response = await api.get('/me');
    return response.data;
  },

  // Marks the user offline. The token is passed explicitly because the caller
  // clears localStorage immediately after calling this.
  logout: async (token) => {
    const response = await api.post('/logout', null, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    return response.data;
  }
};

// Users API
export const usersAPI = {
  getAll: async () => {
    const response = await api.get('/users');
    return response.data;
  },
  
  getById: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  }
};

// Messages API
export const messagesAPI = {
  send: async (messageData) => {
    const response = await api.post('/messages', messageData);
    return response.data;
  },
  
  getConversation: async (userId) => {
    const response = await api.get(`/messages/${userId}`);
    return response.data;
  }
};

export default api;
