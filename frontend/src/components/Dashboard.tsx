import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  HeartIcon,
  VideoCameraIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

import { useAuthStore } from '../store/auth';
import { matchingAPI, videoAPI, continuousMatchingAPI } from '../utils/api';
import PendingCallsNotification from './video/PendingCallsNotification';

interface Match {
  id: number;
  user_id: number;
  matched_user_id: number;
  compatibility_score: number;
  status: string;
  video_session_id: string;
  call_completed: boolean;
  matched_user_name: string;
  matched_user_age: number;
  matched_user_bio?: string;
  matched_user_interests: string[];
  user_decision?: string;
  matched_user_decision?: string;
}

interface ActiveSession {
  session_id: string;
  status: string;
  match_id: number;
  started_at?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuthStore();
  
  // Debug logging
  console.log('🏠 Dashboard - Current state:', { 
    hasUser: !!user, 
    hasProfile: !!profile, 
    profileData: profile ? 'exists' : 'null' 
  });
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [mutualMatches, setMutualMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load dashboard data - route-level protection handles profile checks
    loadDashboardData();
    // Poll for active sessions every 10 seconds
    const interval = setInterval(loadActiveSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [matchesRes, sessionsRes, mutualRes] = await Promise.all([
        matchingAPI.getMatches(),
        videoAPI.getActiveSessions(),
        matchingAPI.getMutualMatches()
      ]);
      
      setMatches(matchesRes.data);
      setActiveSessions(sessionsRes.data.active_sessions || []);
      setMutualMatches(mutualRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveSessions = async () => {
    try {
      const response = await videoAPI.getActiveSessions();
      setActiveSessions(response.data.active_sessions || []);
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    }
  };

  const handleFindMatches = async () => {
    try {
      setLoading(true);
      const response = await matchingAPI.findMatches();
      
      if (response.data.length > 0) {
        toast.success(`Found ${response.data.length} new matches!`);
        loadDashboardData();
      } else {
        toast('No new matches found at the moment. Try again later!', { icon: 'ℹ️' });
      }
    } catch (error: any) {
      console.error('Failed to find matches:', error);
      if (error.response?.status === 400) {
        toast.error('Please complete your profile first');
      } else {
        toast.error('Failed to find matches');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const pendingMatches = matches.filter(match => !match.call_completed && match.status === 'pending');
  const completedMatches = matches.filter(match => match.call_completed);
  const finalMatches = matches.filter(match => match.status === 'matched');

  if (loading && matches.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600">
        <div className="glass-morphism p-8 rounded-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-700 mt-4 text-center">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-600">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-white">VideoDate</h1>
              <p className="text-white/80">Welcome back, {profile?.name}!</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-morphism p-6 rounded-xl"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <HeartIcon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Matches</p>
                <p className="text-2xl font-semibold text-gray-900">{matches.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-morphism p-6 rounded-xl"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <VideoCameraIcon className="h-8 w-8 text-secondary-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Video Calls</p>
                <p className="text-2xl font-semibold text-gray-900">{completedMatches.length}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-morphism p-6 rounded-xl"
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <SparklesIcon className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Mutual Matches</p>
                <p className="text-2xl font-semibold text-gray-900">{finalMatches.length}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <button
            onClick={handleFindMatches}
            disabled={loading}
            className="btn-primary flex items-center justify-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Finding Matches...
              </>
            ) : (
              <>
                <UserGroupIcon className="h-5 w-5 mr-2" />
                Find New Matches
              </>
            )}
          </button>

          <Link 
            to="/continuous-matching" 
            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center transition-all duration-200 shadow-lg"
          >
            <VideoCameraIcon className="h-5 w-5 mr-2" />
            🎯 Instant Match & Chat
          </Link>

          <Link to="/matching" className="btn-secondary flex items-center justify-center">
            <SparklesIcon className="h-5 w-5 mr-2" />
            View All Matches
          </Link>
        </div>

        {/* Active Video Sessions */}
        {activeSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Active Video Sessions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeSessions.map((session) => (
                <div key={session.session_id} className="glass-morphism p-6 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-800">Video Call</h3>
                      <p className="text-gray-600">Status: {session.status}</p>
                      {session.started_at && (
                        <p className="text-sm text-gray-500">
                          Started: {new Date(session.started_at).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <Link
                      to={`/video-call/${session.session_id}`}
                      className="btn-primary text-sm"
                    >
                      Join Call
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Pending Video Calls */}
        {pendingMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Pending Video Calls</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingMatches.map((match) => (
                <div key={match.id} className="glass-morphism p-6 rounded-xl">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-white">
                        {match.matched_user_name.charAt(0)}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">
                      {match.matched_user_name}, {match.matched_user_age}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {Math.round(match.compatibility_score * 100)}% compatible
                    </p>
                    <div className="flex flex-wrap gap-1 mb-4">
                      {match.matched_user_interests.slice(0, 3).map((interest) => (
                        <span
                          key={interest}
                          className="px-2 py-1 text-xs bg-primary-100 text-primary-800 rounded-full"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const response = await videoAPI.startCall(match.id);
                          navigate(`/video-call/${response.data.session_id}`);
                        } catch (error) {
                          toast.error('Failed to start video call');
                        }
                      }}
                      className="btn-primary w-full text-sm"
                    >
                      Start Video Call
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Completed Calls (Pending Swipe) */}
        {completedMatches.filter(match => 
          ((!match.user_decision || !match.matched_user_decision) && 
           match.status !== 'matched' && 
           match.status !== 'rejected')
        ).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold text-white mb-4">Ready to Decide</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedMatches
                .filter(match => 
                  ((!match.user_decision || !match.matched_user_decision) && 
                   match.status !== 'matched' && 
                   match.status !== 'rejected')
                )
                .map((match) => (
                <div key={match.id} className="glass-morphism p-6 rounded-xl">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-white">
                        {match.matched_user_name.charAt(0)}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">
                      {match.matched_user_name}, {match.matched_user_age}
                    </h3>
                    <p className="text-sm text-green-600 mb-4">✓ Call completed</p>
                    <Link
                      to={`/swipe/${match.id}`}
                      className="btn-primary w-full text-sm"
                    >
                      Make Decision
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Mutual Matches */}
        {finalMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-xl font-semibold text-white mb-4">🎉 Mutual Matches!</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finalMatches.map((match) => (
                <div key={match.id} className="glass-morphism p-6 rounded-xl border-2 border-yellow-300">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl font-bold text-white">
                        {match.matched_user_name.charAt(0)}
                      </span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-800 mb-2">
                      {match.matched_user_name}, {match.matched_user_age}
                    </h3>
                    <p className="text-sm text-yellow-600 mb-4">✨ You both liked each other!</p>
                    <p className="text-xs text-gray-600">
                      You can now start chatting and plan to meet up!
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {matches.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="glass-morphism p-8 rounded-2xl max-w-md mx-auto">
              <HeartIcon className="h-16 w-16 text-primary-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-800 mb-2">No matches yet</h3>
              <p className="text-gray-600 mb-6">
                Click "Find New Matches" to start connecting with compatible people!
              </p>
              <button
                onClick={handleFindMatches}
                className="btn-primary"
              >
                Find Your First Match
              </button>
            </div>
          </motion.div>
        )}
      </div>
      
      {/* Pending Calls Notification */}
      <PendingCallsNotification />
    </div>
  );
};

export default Dashboard;
