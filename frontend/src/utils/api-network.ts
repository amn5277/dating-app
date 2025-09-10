// Temporary file for network testing
// Replace 192.168.1.XXX with your actual server IP address

import axios from 'axios';
import { useAuthStore } from '../store/auth';

// Updated to correct backend endpoint  
const API_BASE_URL = 'https://justanotherdatingapp-production.up.railway.app'; // <-- Deployed backend URL

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/api/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post('/api/auth/token', 
      new URLSearchParams({ username: email, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    ),
  
  getMe: () => api.get('/api/auth/me'),
};

export const profileAPI = {
  create: (profileData: any) => api.post('/api/profile/', profileData),
  get: () => api.get('/api/profile/'),
  update: (profileData: any) => api.put('/api/profile/', profileData),
  getInterests: () => api.get('/api/profile/interests'),
  seedInterests: () => api.post('/api/profile/seed-interests'),
};

export const matchingAPI = {
  findMatches: () => api.post('/api/matching/find'),
  getMatches: () => api.get('/api/matching/'),
  swipe: (matchId: number, decision: 'like' | 'pass') =>
    api.post('/api/matching/swipe', { match_id: matchId, decision }),
  getMutualMatches: () => api.get('/api/matching/mutual'),
  
  unmatch: (matchId: number) =>
    api.post('/api/matching/unmatch', { match_id: matchId }),
    
  getActiveUsers: () => api.get('/api/matching/active-users'),
};

export const videoAPI = {
  startCall: (matchId: number) =>
    api.post('/api/video/start-call', { match_id: matchId }),
  
  getSession: (sessionId: string) =>
    api.get(`/api/video/session/${sessionId}`),
  
  endCall: (sessionId: string) =>
    api.post(`/api/video/end-call/${sessionId}`),
  
  joinCall: (sessionId: string) =>
    api.post(`/api/video/join-call/${sessionId}`),
  
  sendSignal: (signal: any) =>
    api.post('/api/video/signal', signal),
  
  getSignals: (sessionId: string) =>
    api.get(`/api/video/signals/${sessionId}`),
  
  getActiveSessions: () =>
    api.get('/api/video/active-sessions'),
    
  getPendingCalls: () =>
    api.get('/api/video/pending-calls'),
    
  getCallHistory: (matchId: number) =>
    api.get(`/api/video/call-history/${matchId}`),
};

export const continuousMatchingAPI = {
  startMatching: (preferences: any) =>
    api.post('/api/continuous-matching/start', preferences),
  
  getNextMatch: (sessionId: string) =>
    api.post('/api/continuous-matching/next-match', null, { params: { session_id: sessionId } }),
  
  handleDecision: (decision: any) =>
    api.post('/api/continuous-matching/continue-decision', decision),
  
  getSession: (sessionId: string) =>
    api.get(`/api/continuous-matching/session/${sessionId}`),
  
  endSession: (sessionId: string) =>
    api.post(`/api/continuous-matching/end-session/${sessionId}`),
};

export default api;
