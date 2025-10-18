import axios from 'axios';

// Base API URL - uses proxy in development, can be configured for production
const API_URL = process.env.REACT_APP_API_URL || '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

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
    if (error.response?.status === 401) {
      // Token expired or invalid - clear storage and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
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