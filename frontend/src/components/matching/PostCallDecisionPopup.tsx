import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartIcon, XMarkIcon, ArrowRightIcon, VideoCameraIcon } from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import { continuousMatchingAPI } from '../../utils/api';

interface PostCallDecisionPopupProps {
  isOpen: boolean;
  matchData: {
    match_id: number;
    user_name: string;
    user_age: number;
    user_bio: string;
    user_interests: string[];
    compatibility_score: number;
  };
  sessionId: string;
  onContinue: () => void;
  onNext: () => void;
  onClose: () => void;
}

const PostCallDecisionPopup: React.FC<PostCallDecisionPopupProps> = ({
  isOpen,
  matchData,
  sessionId,
  onContinue,
  onNext,
  onClose
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState<'continue' | 'next' | null>(null);

  const handleDecision = async (userDecision: 'continue' | 'next') => {
    try {
      setIsSubmitting(true);
      setDecision(userDecision);

      const response = await continuousMatchingAPI.handleDecision({
        session_id: sessionId,
        decision: userDecision,
        match_id: matchData.match_id
      });

      if (userDecision === 'continue') {
        toast.success('🎉 Great choice! You can continue video calling with them.');
        onContinue();
      } else {
        toast('Looking for your next match...', { icon: '🔍' });
        onNext();
      }

      onClose();

    } catch (error: any) {
      console.error('Failed to handle decision:', error);
      toast.error('Failed to process your decision. Please try again.');
    } finally {
      setIsSubmitting(false);
      setDecision(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 50 }}
          className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
        >
          {/* Header */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="w-20 h-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <span className="text-3xl font-bold text-white">
                {matchData.user_name.charAt(0)}
              </span>
            </motion.div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              How was your video date?
            </h2>
            <p className="text-gray-600">
              with <span className="font-semibold">{matchData.user_name}, {matchData.user_age}</span>
            </p>
          </div>

          {/* Match Info */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Compatibility</span>
              <div className="flex items-center">
                {'★'.repeat(Math.round(matchData.compatibility_score * 5))}
                <span className="ml-1 text-sm text-gray-600">
                  {(matchData.compatibility_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            
            {matchData.user_bio && (
              <p className="text-sm text-gray-700 mb-3">"{matchData.user_bio}"</p>
            )}
            
            <div className="flex flex-wrap gap-1">
              {matchData.user_interests.slice(0, 5).map((interest) => (
                <span
                  key={interest}
                  className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs"
                >
                  {interest}
                </span>
              ))}
              {matchData.user_interests.length > 5 && (
                <span className="px-2 py-1 bg-gray-200 text-gray-600 rounded-full text-xs">
                  +{matchData.user_interests.length - 5} more
                </span>
              )}
            </div>
          </div>

          {/* Decision Buttons */}
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDecision('continue')}
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
            >
              {isSubmitting && decision === 'continue' ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Processing...
                </>
              ) : (
                <>
                  <HeartSolidIcon className="h-6 w-6 mr-3" />
                  💕 Continue Video Dating
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleDecision('next')}
              disabled={isSubmitting}
              className="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isSubmitting && decision === 'next' ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Finding next...
                </>
              ) : (
                <>
                  <ArrowRightIcon className="h-6 w-6 mr-3" />
                  Next Person Please
                </>
              )}
            </motion.button>
          </div>

          {/* Explanation Text */}
          <div className="mt-6 p-4 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-700 text-center">
              <strong>Continue:</strong> Keep video calling with {matchData.user_name} as much as you want!<br/>
              <strong>Next:</strong> Find another active person for a new 1-minute video date
            </p>
          </div>

          {/* Skip/Close Option */}
          <div className="text-center mt-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-sm underline"
              disabled={isSubmitting}
            >
              Skip decision for now
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PostCallDecisionPopup;
