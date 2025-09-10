import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  HeartIcon,
  XMarkIcon,
  ArrowLeftIcon,
  SparklesIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';

import { matchingAPI } from '../../utils/api';

interface MatchData {
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
}

const SwipeInterface: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [swipeLoading, setSwipeLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [swipeResult, setSwipeResult] = useState<'matched' | 'no-match' | null>(null);

  useEffect(() => {
    if (matchId) {
      loadMatchData();
    }
  }, [matchId]);

  const loadMatchData = async () => {
    try {
      setLoading(true);
      // Get all matches and find the specific one
      const response = await matchingAPI.getMatches();
      const matches = response.data;
      const currentMatch = matches.find((m: MatchData) => m.id === parseInt(matchId!));
      
      if (!currentMatch) {
        toast.error('Match not found');
        navigate('/dashboard');
        return;
      }
      
      if (!currentMatch.call_completed) {
        toast.error('Please complete the video call first');
        navigate('/dashboard');
        return;
      }
      
      // Check if this match is already decided (mutual match or rejected)
      if (currentMatch.status === 'matched') {
        toast.success('🎉 You already have a mutual match with this person!');
        navigate('/dashboard');
        return;
      }
      
      if (currentMatch.status === 'rejected') {
        toast('This match didn\'t work out, but there are plenty of other amazing people!');
        navigate('/dashboard');  
        return;
      }
      
      setMatch(currentMatch);
    } catch (error) {
      console.error('Failed to load match data:', error);
      toast.error('Failed to load match data');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (decision: 'like' | 'pass') => {
    if (!match || swipeLoading) return;
    
    try {
      setSwipeLoading(true);
      
      const response = await matchingAPI.swipe(match.id, decision);
      const result = response.data;
      
      if (result.is_mutual_match) {
        setSwipeResult('matched');
        toast.success('🎉 It\'s a mutual match!');
      } else if (decision === 'like') {
        setSwipeResult('no-match');
        toast('Your like has been sent. Waiting for their decision.', { icon: 'ℹ️' });
      } else {
        setSwipeResult('no-match');
        toast('You passed on this match.', { icon: 'ℹ️' });
      }
      
      setShowResult(true);
      
      // Auto-redirect after showing result
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
      
    } catch (error) {
      console.error('Failed to swipe:', error);
      toast.error('Failed to record your decision');
    } finally {
      setSwipeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600">
        <div className="glass-morphism p-8 rounded-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-700 mt-4 text-center">Loading match details...</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600">
        <div className="glass-morphism p-8 rounded-2xl text-center">
          <XMarkIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Match Not Found</h2>
          <p className="text-gray-600 mb-4">This match could not be loaded.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-600">
      <AnimatePresence>
        {!showResult ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8"
          >
            <div className="max-w-md w-full">
              {/* Back Button */}
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center text-white/80 hover:text-white mb-6 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Back to Dashboard
              </button>

              {/* Profile Card */}
              <div className="glass-morphism rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-6 text-white text-center">
                  <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl font-bold">
                      {match.matched_user_name.charAt(0)}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold mb-1">
                    {match.matched_user_name}, {match.matched_user_age}
                  </h2>
                  <div className="flex items-center justify-center text-sm opacity-90">
                    <SparklesIcon className="h-4 w-4 mr-1" />
                    {Math.round(match.compatibility_score * 100)}% Compatible
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Bio */}
                  {match.matched_user_bio && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">About</h3>
                      <p className="text-gray-600 leading-relaxed">
                        {match.matched_user_bio}
                      </p>
                    </div>
                  )}

                  {/* Interests */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {match.matched_user_interests.map((interest, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium"
                        >
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Call Reminder */}
                  <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center text-green-800">
                      <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                      <span className="font-medium">You just had a video call together!</span>
                    </div>
                    <p className="text-green-700 text-sm mt-1">
                      How did you feel about the conversation? Did you connect well?
                    </p>
                  </div>

                  {/* Decision Question */}
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      What did you think?
                    </h3>
                    <p className="text-gray-600">
                      Would you like to continue chatting and potentially meet up?
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSwipe('pass')}
                      disabled={swipeLoading}
                      className="flex items-center justify-center p-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <XMarkIcon className="h-8 w-8 text-gray-600 mr-2" />
                      <span className="font-semibold text-gray-800">Pass</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSwipe('like')}
                      disabled={swipeLoading}
                      className="flex items-center justify-center p-4 bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 rounded-xl transition-all disabled:opacity-50"
                    >
                      <HeartSolidIcon className="h-8 w-8 text-white mr-2" />
                      <span className="font-semibold text-white">Like</span>
                    </motion.button>
                  </div>

                  {swipeLoading && (
                    <div className="mt-4 text-center">
                      <div className="inline-flex items-center text-primary-600">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                        Recording your decision...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8"
          >
            <div className="text-center">
              <div className="glass-morphism p-8 rounded-2xl max-w-md">
                {swipeResult === 'matched' ? (
                  <div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.6 }}
                      className="w-20 h-20 bg-gradient-to-r from-yellow-400 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                      <HeartSolidIcon className="h-10 w-10 text-white" />
                    </motion.div>
                    
                    <h2 className="text-3xl font-bold text-gray-800 mb-4">
                      🎉 It's a Match!
                    </h2>
                    
                    <p className="text-gray-600 mb-6 leading-relaxed">
                      You both liked each other! You can now start chatting and plan to meet up.
                      Your mutual match will appear in your dashboard.
                    </p>
                    
                    <div className="flex items-center justify-center space-x-2 text-primary-600 mb-6">
                      <SparklesIcon className="h-5 w-5" />
                      <span className="font-medium">
                        {match.matched_user_name} liked you too!
                      </span>
                      <SparklesIcon className="h-5 w-5" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', duration: 0.6 }}
                      className="w-20 h-20 bg-primary-500 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                      <HeartIcon className="h-10 w-10 text-white" />
                    </motion.div>
                    
                    <h2 className="text-2xl font-bold text-gray-800 mb-4">
                      Decision Recorded
                    </h2>
                    
                    <p className="text-gray-600 mb-6">
                      Thank you for your feedback! Keep exploring and finding meaningful connections.
                    </p>
                  </div>
                )}
                
                <div className="text-sm text-gray-500">
                  Redirecting to dashboard in a moment...
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SwipeInterface;
