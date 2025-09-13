import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StarIcon, HeartIcon, ChatBubbleLeftRightIcon, AcademicCapIcon, FaceSmileIcon, ShieldCheckIcon, HandRaisedIcon, SparklesIcon } from '@heroicons/react/24/solid';
import { StarIcon as StarOutline } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface PersonalityRatingData {
  rated_user_id: number;
  video_session_id?: string;
  match_id?: number;
  friendliness: number;
  conversational_skills: number;
  sense_of_humor: number;
  intelligence: number;
  attractiveness: number;
  authenticity: number;
  respect_level: number;
  compatibility: number;
  written_feedback?: string;
}

interface PersonalityRatingPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (ratingData: PersonalityRatingData) => Promise<void>;
  ratedUserName: string;
  ratedUserId: number;
  videoSessionId?: string;
  matchId?: number;
}

interface TraitConfig {
  key: keyof Omit<PersonalityRatingData, 'rated_user_id' | 'video_session_id' | 'match_id' | 'written_feedback'>;
  label: string;
  icon: React.ComponentType<any>;
  description: string;
  color: string;
}

const traits: TraitConfig[] = [
  {
    key: 'friendliness',
    label: 'Friendliness',
    icon: HeartIcon,
    description: 'How warm and friendly were they?',
    color: 'text-pink-500'
  },
  {
    key: 'conversational_skills',
    label: 'Conversation Skills',
    icon: ChatBubbleLeftRightIcon,
    description: 'How engaging was the conversation?',
    color: 'text-blue-500'
  },
  {
    key: 'sense_of_humor',
    label: 'Sense of Humor',
    icon: FaceSmileIcon,
    description: 'How funny and entertaining were they?',
    color: 'text-yellow-500'
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    icon: AcademicCapIcon,
    description: 'How smart and insightful did they seem?',
    color: 'text-purple-500'
  },
  {
    key: 'attractiveness',
    label: 'Attractiveness',
    icon: SparklesIcon,
    description: 'How attractive did you find them?',
    color: 'text-rose-500'
  },
  {
    key: 'authenticity',
    label: 'Authenticity',
    icon: ShieldCheckIcon,
    description: 'How genuine and authentic were they?',
    color: 'text-green-500'
  },
  {
    key: 'respect_level',
    label: 'Respect Level',
    icon: HandRaisedIcon,
    description: 'How respectful were they during the call?',
    color: 'text-indigo-500'
  },
  {
    key: 'compatibility',
    label: 'Compatibility',
    icon: StarIcon,
    description: 'How compatible did you feel with them?',
    color: 'text-amber-500'
  }
];

const PersonalityRatingPopup: React.FC<PersonalityRatingPopupProps> = ({
  isVisible,
  onClose,
  onSubmit,
  ratedUserName,
  ratedUserId,
  videoSessionId,
  matchId
}) => {
  const [ratings, setRatings] = useState<Record<string, number>>({
    friendliness: 5,
    conversational_skills: 5,
    sense_of_humor: 5,
    intelligence: 5,
    attractiveness: 5,
    authenticity: 5,
    respect_level: 5,
    compatibility: 5
  });
  const [writtenFeedback, setWrittenFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSliderChange = (traitKey: string, value: number) => {
    setRatings(prev => ({
      ...prev,
      [traitKey]: value
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const ratingData: PersonalityRatingData = {
        rated_user_id: ratedUserId,
        video_session_id: videoSessionId,
        match_id: matchId,
        friendliness: ratings.friendliness,
        conversational_skills: ratings.conversational_skills,
        sense_of_humor: ratings.sense_of_humor,
        intelligence: ratings.intelligence,
        attractiveness: ratings.attractiveness,
        authenticity: ratings.authenticity,
        respect_level: ratings.respect_level,
        compatibility: ratings.compatibility,
        written_feedback: writtenFeedback.trim() || undefined
      };

      await onSubmit(ratingData);
      toast.success('Rating submitted successfully! 🌟');
      onClose();
    } catch (error: any) {
      console.error('Failed to submit rating:', error);
      toast.error('Failed to submit rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateAverage = () => {
    const values = Object.values(ratings);
    return (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(1);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 10 }, (_, i) => (
      <StarIcon
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  // 🧪 DEBUG: Log props received
  console.log('🧪 PersonalityRatingPopup render:', { 
    isVisible, 
    ratedUserName, 
    ratedUserId, 
    videoSessionId, 
    matchId 
  });

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-t-2xl">
              <h2 className="text-2xl font-bold mb-2">Rate Your Experience</h2>
              <p className="text-purple-100">
                How was your conversation with <span className="font-semibold">{ratedUserName}</span>?
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm">Overall Average:</span>
                <span className="font-bold text-lg">{calculateAverage()}/10</span>
                <div className="flex ml-2">
                  {renderStars(Math.round(parseFloat(calculateAverage())))}
                </div>
              </div>
            </div>

            {/* Rating Sliders */}
            <div className="p-6 space-y-6">
              {traits.map((trait) => {
                const IconComponent = trait.icon;
                const currentRating = ratings[trait.key];

                return (
                  <div key={trait.key} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <IconComponent className={`w-6 h-6 ${trait.color}`} />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{trait.label}</h3>
                        <p className="text-sm text-gray-600">{trait.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-gray-900">{currentRating}/10</div>
                        <div className="flex">
                          {renderStars(currentRating)}
                        </div>
                      </div>
                    </div>

                    {/* Custom Slider */}
                    <div className="relative">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={currentRating}
                        onChange={(e) => handleSliderChange(trait.key, parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                        style={{
                          background: `linear-gradient(to right, 
                            #ef4444 0%, #ef4444 20%, 
                            #f97316 20%, #f97316 40%, 
                            #eab308 40%, #eab308 60%, 
                            #22c55e 60%, #22c55e 80%, 
                            #16a34a 80%, #16a34a 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Poor</span>
                        <span>Average</span>
                        <span>Excellent</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Written Feedback */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <ChatBubbleLeftRightIcon className="w-6 h-6 text-gray-500" />
                  <h3 className="font-semibold text-gray-900">Additional Comments (Optional)</h3>
                </div>
                <textarea
                  value={writtenFeedback}
                  onChange={(e) => setWrittenFeedback(e.target.value)}
                  placeholder={`Any additional thoughts about your conversation with ${ratedUserName}?`}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  rows={3}
                  maxLength={500}
                />
                <div className="text-right text-xs text-gray-500">
                  {writtenFeedback.length}/500 characters
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex gap-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Skip Rating
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <StarIcon className="w-4 h-4" />
                    Submit Rating
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PersonalityRatingPopup;
