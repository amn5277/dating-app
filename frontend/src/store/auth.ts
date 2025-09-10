import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: number;
  name: string;
  age: number;
  gender: string;
  location?: string;
  bio?: string;
  extroversion: number;
  openness: number;
  conscientiousness: number;
  agreeableness: number;
  neuroticism: number;
  looking_for: string;
  min_age: number;
  max_age: number;
  max_distance: number;
  interests: Interest[];
}

export interface Interest {
  id: number;
  name: string;
  category: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: Profile | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
      
      setUser: (user: User | null) => set({ 
        user, 
        isAuthenticated: !!user 
      }),
      
      setProfile: (profile: Profile | null) => {
        console.log('🏪 Store: setProfile called with:', { 
          hasProfile: !!profile, 
          profileId: profile?.id, 
          profileName: profile?.name,
          fullProfile: profile 
        });
        set({ profile });
        console.log('🏪 Store: Profile set in state');
      },
      
      setToken: (token: string | null) => set({ 
        token, 
        isAuthenticated: !!token 
      }),
      
      logout: () => set({ 
        user: null, 
        profile: null, 
        token: null, 
        isAuthenticated: false 
      }),
      
      setLoading: (isLoading: boolean) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
