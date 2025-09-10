import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PlayIcon,
  HeartIcon,
  XMarkIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  VideoCameraIcon,
  PauseIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon, PlayIcon as PlaySolidIcon } from '@heroicons/react/24/solid';

import { continuousMatchingAPI } from '../../utils/api';
import { useAuthStore } from '../../store/auth';

interface MatchingPreferences {
  min_age: number;
  max_age: number;
  preferred_interests: string[];
  personality_weight: number;
}

interface MatchingSession {
  session_id: string;
  status: string;
  matches_made: number;
  successful_matches: number;
  current_match?: any;
}

interface CurrentMatch {
  match_id: number;
  video_session_id: string;
  user_name: string;
  user_age: number;
  user_bio: string;
  user_interests: string[];
  compatibility_score: number;
}

const ContinuousMatchingInterface: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuthStore();
  
  const [isMatching, setIsMatching] = useState(false);
  const [matchingSession, setMatchingSession] = useState<MatchingSession | null>(null);
  const [currentMatch, setCurrentMatch] = useState<CurrentMatch | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [matchingStats, setMatchingStats] = useState({ matches_made: 0, successful_matches: 0 });
  
  const [preferences, setPreferences] = useState<MatchingPreferences>({
    min_age: 18,
    max_age: 35,
    preferred_interests: [],
    personality_weight: 0.5
  });

  // Available interests for selection
  const availableInterests = [
    'Travel', 'Music', 'Movies', 'Books', 'Sports', 'Gaming', 'Cooking', 
    'Photography', 'Art', 'Technology', 'Fitness', 'Dancing', 'Hiking',
    'Fashion', 'Food', 'Animals', 'Nature', 'Science', 'History', 'Business'
  ];

  // Cleanup function to end session
  const cleanupSession = async () => {
    if (matchingSession?.session_id) {
      try {
        console.log('🧹 Cleaning up matching session:', matchingSession.session_id);
        await continuousMatchingAPI.endSession(matchingSession.session_id);
      } catch (error) {
        console.error('Failed to cleanup session:', error);
      }
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, [matchingSession?.session_id]);

  // Cleanup on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (matchingSession?.session_id) {
        // Use sendBeacon for reliable cleanup during unload
        const data = JSON.stringify({ session_id: matchingSession.session_id });
        navigator.sendBeacon('/api/continuous-matching/end-session/' + matchingSession.session_id, data);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && matchingSession?.session_id) {
        // User switched tabs or minimized - clean up after a delay
        setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            cleanupSession();
          }
        }, 30000); // 30 second delay
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [matchingSession?.session_id]);

  const handleStartMatching = async () => {
    try {
      setIsLoading(true);
      
      // Start matching session
      const response = await continuousMatchingAPI.startMatching(preferences);
      const session = response.data;
      
      setMatchingSession(session);
      setIsMatching(true);
      setMatchingStats({ matches_made: 0, successful_matches: 0 });
      
      toast.success('🎉 Started continuous matching! Looking for your first match...');
      
      // Immediately try to get first match
      await getNextMatch(session.session_id);
      
    } catch (error: any) {
      console.error('Failed to start matching:', error);
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to start matching. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getNextMatch = async (sessionId: string) => {
    try {
      setIsLoading(true);
      
      const response = await continuousMatchingAPI.getNextMatch(sessionId);
      const nextMatchData = response.data;
      
      setMatchingStats(nextMatchData.session_stats);
      
      if (nextMatchData.match_found && nextMatchData.match_data) {
        setCurrentMatch(nextMatchData.match_data);
        
        toast.success(`🎯 Found a match: ${nextMatchData.match_data.user_name}!`);
        
        // Auto-start video call
        setTimeout(() => {
          startVideoCall(nextMatchData.match_data.video_session_id);
        }, 2000);
        
      } else {
        toast(nextMatchData.message, { 
          icon: '⏳',
          duration: 5000 
        });
        
        // Try again after a delay
        setTimeout(() => {
          getNextMatch(sessionId);
        }, 10000);
      }
      
    } catch (error: any) {
      console.error('Failed to get next match:', error);
      toast.error('Failed to find next match. Retrying...');
      
      // Retry after delay
      setTimeout(() => {
        getNextMatch(sessionId);
      }, 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const startVideoCall = (videoSessionId: string) => {
    console.log('🎥 Starting video call with session ID:', videoSessionId);
    // Navigate to video call with special continuous matching flag
    navigate(`/video-call/${videoSessionId}?continuous=true&session_id=${matchingSession?.session_id}&match_id=${currentMatch?.match_id}`);
  };

  const handleStopMatching = async () => {
    if (!matchingSession) return;
    
    try {
      await continuousMatchingAPI.endSession(matchingSession.session_id);
      
      setIsMatching(false);
      setMatchingSession(null);
      setCurrentMatch(null);
      
      toast.success(`🎉 Matching completed! Made ${matchingStats.matches_made} connections with ${matchingStats.successful_matches} successful matches.`);
      
    } catch (error) {
      console.error('Failed to stop matching:', error);
      toast.error('Failed to stop matching session');
    }
  };

  const toggleInterest = (interest: string) => {
    setPreferences(prev => {
      const newInterests = prev.preferred_interests.includes(interest)
        ? prev.preferred_interests.filter(i => i !== interest)
        : [...prev.preferred_interests, interest];
      
      return { ...prev, preferred_interests: newInterests };
    });
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-600 flex items-center justify-center">
        <div className="glass-morphism p-8 rounded-2xl text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Complete Your Profile</h2>
          <p className="text-gray-600 mb-6">You need to complete your profile before you can start continuous matching.</p>
          <button
            onClick={() => navigate('/profile-setup')}
            className="btn-primary"
          >
            Complete Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-600 p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-white mb-2"
          >
            🎯 Continuous Matching
          </motion.h1>
          <p className="text-white/80 text-lg">
            Meet active users one-at-a-time with 1-minute video speed dates
          </p>
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {!isMatching ? (
            // Start Matching Interface
            <motion.div
              key="start-interface"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              {/* Preferences Panel */}
              <div className="glass-morphism rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                    <Cog6ToothIcon className="h-6 w-6 mr-2" />
                    Matching Preferences
                  </h2>
                  <button
                    onClick={() => setShowPreferences(!showPreferences)}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {showPreferences ? 'Hide' : 'Customize'}
                  </button>
                </div>

                <AnimatePresence>
                  {showPreferences && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4"
                    >
                      {/* Age Range */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Age Range: {preferences.min_age} - {preferences.max_age}
                        </label>
                        <div className="flex items-center space-x-4">
                          <input
                            type="range"
                            min="18"
                            max="100"
                            value={preferences.min_age}
                            onChange={(e) => setPreferences(prev => ({ ...prev, min_age: parseInt(e.target.value) }))}
                            className="flex-1"
                          />
                          <input
                            type="range"
                            min="18"
                            max="100"
                            value={preferences.max_age}
                            onChange={(e) => setPreferences(prev => ({ ...prev, max_age: parseInt(e.target.value) }))}
                            className="flex-1"
                          />
                        </div>
                      </div>

                      {/* Preferred Interests */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Preferred Interests ({preferences.preferred_interests.length} selected)
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                          {availableInterests.map((interest) => (
                            <button
                              key={interest}
                              onClick={() => toggleInterest(interest)}
                              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                preferences.preferred_interests.includes(interest)
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {interest}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Personality Weight */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Personality vs Interests Weight: {(preferences.personality_weight * 100).toFixed(0)}% personality
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={preferences.personality_weight}
                          onChange={(e) => setPreferences(prev => ({ ...prev, personality_weight: parseFloat(e.target.value) }))}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>More Interests</span>
                          <span>More Personality</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* How It Works */}
              <div className="glass-morphism rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <UserGroupIcon className="h-5 w-5 mr-2" />
                  How Continuous Matching Works
                </h3>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">1</div>
                    <div>
                      <p className="font-medium">Find Active Users</p>
                      <p className="text-gray-600">Match with people online right now</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">2</div>
                    <div>
                      <p className="font-medium">1-Minute Video Date</p>
                      <p className="text-gray-600">Quick video call to see if you click</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">3</div>
                    <div>
                      <p className="font-medium">Continue or Next</p>
                      <p className="text-gray-600">Keep chatting or find someone new</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Start Button */}
              <div className="text-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStartMatching}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-full text-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Starting...
                    </>
                  ) : (
                    <>
                      <PlaySolidIcon className="h-6 w-6 mr-3" />
                      Start Matching
                    </>
                  )}
                </motion.button>
                <p className="text-white/70 mt-3 text-sm">
                  Connect with active users instantly
                </p>
              </div>
            </motion.div>
          ) : (
            // Active Matching Interface
            <motion.div
              key="matching-interface"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              {/* Stats */}
              <div className="glass-morphism rounded-2xl p-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-800">{matchingStats.matches_made}</div>
                    <div className="text-sm text-gray-600">Matches Made</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">{matchingStats.successful_matches}</div>
                    <div className="text-sm text-gray-600">Successful</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {matchingStats.matches_made > 0 ? Math.round((matchingStats.successful_matches / matchingStats.matches_made) * 100) : 0}%
                    </div>
                    <div className="text-sm text-gray-600">Success Rate</div>
                  </div>
                </div>
              </div>

              {/* Current Match or Loading */}
              {currentMatch ? (
                <div className="glass-morphism rounded-2xl p-6 text-center">
                  <div className="mb-4">
                    <div className="w-24 h-24 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl font-bold text-white">
                        {currentMatch.user_name.charAt(0)}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-1">
                      {currentMatch.user_name}, {currentMatch.user_age}
                    </h3>
                    <p className="text-gray-600 mb-2">{currentMatch.user_bio}</p>
                    <div className="flex justify-center items-center space-x-2 mb-4">
                      <span className="text-sm text-gray-500">Compatibility:</span>
                      <div className="flex items-center">
                        {'★'.repeat(Math.round(currentMatch.compatibility_score * 5))}
                        <span className="ml-1 text-sm text-gray-600">
                          {(currentMatch.compatibility_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {currentMatch.user_interests.slice(0, 4).map((interest) => (
                        <span
                          key={interest}
                          className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs"
                        >
                          {interest}
                        </span>
                      ))}
                      {currentMatch.user_interests.length > 4 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                          +{currentMatch.user_interests.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => startVideoCall(currentMatch.video_session_id)}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-full flex items-center mx-auto"
                  >
                    <VideoCameraIcon className="h-5 w-5 mr-2" />
                    Start Video Date
                  </motion.button>
                </div>
              ) : (
                <div className="glass-morphism rounded-2xl p-8 text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {isLoading ? 'Finding Your Next Match...' : 'Searching for Active Users...'}
                  </h3>
                  <p className="text-gray-600">
                    Looking for someone special who's online right now
                  </p>
                </div>
              )}

              {/* Stop Button */}
              <div className="text-center">
                <button
                  onClick={handleStopMatching}
                  className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-full flex items-center mx-auto"
                >
                  <PauseIcon className="h-5 w-5 mr-2" />
                  Stop Matching
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ContinuousMatchingInterface;
