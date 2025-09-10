import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/auth';
import { authAPI } from './utils/api';

// Import components
import LandingPage from './components/LandingPage';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ProfileCreation from './components/profile/ProfileCreation';
import Dashboard from './components/Dashboard';
import VideoCall from './components/video/VideoCall';
import MatchingInterface from './components/matching/MatchingInterface';
import ContinuousMatchingInterface from './components/matching/ContinuousMatchingInterface';
import SwipeInterface from './components/matching/SwipeInterface';
import ProtectedRoute from './components/ProtectedRoute';
import DebugAuthState from './components/DebugAuthState';

// Helper to get API URL for debugging
const getApiBaseUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://10.101.83.3:8004';
};

function App() {
  const { isAuthenticated, token, user, profile, isLoading, setUser, setProfile, setLoading } = useAuthStore();

  useEffect(() => {
    // Show network info for debugging
    const apiUrl = getApiBaseUrl();
    console.log(`🌐 VideoDate Frontend running on: ${window.location.origin}`);
    console.log(`🔗 API Backend URL: ${apiUrl}`);
    console.log(`📱 Access from network: http://${window.location.hostname}:${window.location.port || '3000'}`);
    
    // Debug current state  
    console.log('🔍 App initialization - Current auth state:', { 
      user: !!user, 
      profile: !!profile, 
      token: !!token,
      profileObject: profile
    });
    
    // Check localStorage for persisted profile
    try {
      const storedAuth = localStorage.getItem('auth-storage');
      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        console.log('🗄️  Found stored auth data:', { 
          hasStoredProfile: !!parsedAuth.state?.profile,
          storedProfile: parsedAuth.state?.profile
        });
      }
    } catch (error) {
      console.log('📦 No stored auth data or parsing error');
    }
    
    // Initialize app - only fetch user data if we have token but no user
    // Profile loading is now handled by login/register components
    const initializeApp = async () => {
      if (token && !user) {
        console.log('🚀 App: Initializing app - fetching user data only...');
        try {
          setLoading(true);
          console.log('📡 Fetching user data...');
          const response = await authAPI.getMe();
          console.log('✅ User data fetched:', response.data);
          setUser(response.data);
          
          // Don't fetch profile here - login/register components handle it
          // This prevents race conditions and double-fetching
          console.log('ℹ️  Skipping profile fetch - handled by auth components');
          
        } catch (error) {
          console.error('Failed to initialize app:', error);
          useAuthStore.getState().logout();
        } finally {
          setLoading(false);
        }
      } else if (token && user && !profile) {
        // Edge case: we have token and user but no profile (page refresh scenario)
        console.log('🔄 Page refresh detected - fetching profile...');
        try {
          const profileAPI = await import('./utils/api').then(m => m.profileAPI);
          const profileResponse = await profileAPI.get();
          console.log('✅ Profile fetched on refresh:', profileResponse.data);
          setProfile(profileResponse.data);
        } catch (profileError: any) {
          console.log('ℹ️  No profile found on refresh - user needs to create one');
          setProfile(null);
        }
      }
    };

    initializeApp();
  }, [token, user, setUser, setProfile, setLoading]);

  return (
    <div className="App min-h-screen">
      <Router>
        <Routes>
          {/* Public routes */}
          <Route 
            path="/" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />} 
          />
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <LoginPage />} 
          />
          <Route 
            path="/register" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterPage />} 
          />
          
          {/* Protected routes */}
          <Route 
            path="/profile-setup" 
            element={
              <ProtectedRoute>
                <ProfileCreation />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                {(() => {
                  console.log('🛣️  Dashboard route check:', { 
                    hasProfile: !!profile, 
                    profileId: profile?.id,
                    profileName: profile?.name,
                    isLoading: isLoading,
                    hasUser: !!user
                  });
                  
                  // Show loading while user/profile data is being fetched
                  if (isLoading) {
                    return (
                      <div className="min-h-screen flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                          <p className="text-gray-600">Loading your profile...</p>
                        </div>
                      </div>
                    );
                  }
                  
                  // Only redirect to profile setup if we're not loading and have no profile
                  return !profile ? <Navigate to="/profile-setup" /> : <Dashboard />;
                })()}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/matching" 
            element={
              <ProtectedRoute>
                {(() => {
                  // Show loading while user/profile data is being fetched
                  if (isLoading) {
                    return (
                      <div className="min-h-screen flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                          <p className="text-gray-600">Loading your profile...</p>
                        </div>
                      </div>
                    );
                  }
                  
                  return !profile ? <Navigate to="/profile-setup" /> : <MatchingInterface />;
                })()}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/continuous-matching" 
            element={
              <ProtectedRoute>
                {(() => {
                  // Show loading while user/profile data is being fetched
                  if (isLoading) {
                    return (
                      <div className="min-h-screen flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                          <p className="text-gray-600">Loading your profile...</p>
                        </div>
                      </div>
                    );
                  }
                  
                  return !profile ? <Navigate to="/profile-setup" /> : <ContinuousMatchingInterface />;
                })()}
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/video-call/:sessionId" 
            element={
              <ProtectedRoute>
                <VideoCall />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/swipe/:matchId" 
            element={
              <ProtectedRoute>
                <SwipeInterface />
              </ProtectedRoute>
            } 
          />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
      
      {/* Toast notifications */}
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            color: '#333',
          },
        }}
      />
      
      {/* Debug auth state in development */}
      <DebugAuthState />
    </div>
  );
}

export default App;
