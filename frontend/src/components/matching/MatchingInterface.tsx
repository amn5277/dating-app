import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  HeartIcon,
  VideoCameraIcon,
  ArrowLeftIcon,
  SparklesIcon,
  ClockIcon,
  CheckCircleIcon,
  UserGroupIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

import { matchingAPI, videoAPI } from '../../utils/api';
import PendingCallsNotification from '../video/PendingCallsNotification';

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
}

interface ActiveUserInfo {
  online_now: number;
  active_last_hour: number;
  active_today: number;
  recent_active_users: Array<{
    name: string;
    age: number;
    minutes_ago: number;
    status: string;
  }>;
}

const MatchingInterface: React.FC = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'matched'>('all');
  const [activeUsers, setActiveUsers] = useState<ActiveUserInfo | null>(null);
  const [callHistories, setCallHistories] = useState<Record<number, any>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load matches and active users in parallel
      const [matchesResponse, activeUsersResponse] = await Promise.all([
        matchingAPI.getMatches(),
        matchingAPI.getActiveUsers()
      ]);
      
      const matchesData = matchesResponse.data;
      setMatches(matchesData);
      setActiveUsers(activeUsersResponse.data);
      
      // Load call histories for mutual matches
      const mutualMatches = matchesData.filter((match: Match) => match.status === 'matched');
      if (mutualMatches.length > 0) {
        const historyPromises = mutualMatches.map(async (match: Match) => {
          try {
            const historyResponse = await videoAPI.getCallHistory(match.id);
            return { matchId: match.id, history: historyResponse.data };
          } catch (error) {
            console.log(`Failed to load call history for match ${match.id}:`, error);
            return { matchId: match.id, history: null };
          }
        });
        
        const histories = await Promise.all(historyPromises);
        const historyMap = histories.reduce((acc, { matchId, history }) => {
          if (history) acc[matchId] = history;
          return acc;
        }, {} as Record<number, any>);
        
        setCallHistories(historyMap);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const loadMatches = async () => {
    try {
      setLoading(true);
      const response = await matchingAPI.getMatches();
      setMatches(response.data);
    } catch (error) {
      console.error('Failed to load matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleStartVideoCall = async (matchId: number) => {
    try {
      // Check if this is a mutual match
      const match = matches.find(m => m.id === matchId);
      const isMutualMatch = match?.status === 'matched';
      
      if (isMutualMatch) {
        toast('💕 Starting new video call with your mutual match!', { icon: '📞' });
      }
      
      const response = await videoAPI.startCall(matchId);
      navigate(`/video-call/${response.data.session_id}`);
    } catch (error: any) {
      console.error('Failed to start video call:', error);
      
      // Provide specific error messages
      if (error.response?.status === 400) {
        const message = error.response.data.detail;
        if (message.includes('Call already in progress')) {
          toast.error('A call is already in progress with this user');
        } else {
          toast.error(message);
        }
      } else {
        toast.error('Failed to start video call. Please try again.');
      }
    }
  };

  const handleUnmatch = async (matchId: number, matchName: string) => {
    if (!window.confirm(`Are you sure you want to unmatch with ${matchName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await matchingAPI.unmatch(matchId);
      toast.success(`Unmatched with ${matchName}`);
      // Refresh matches list
      await loadMatches();
    } catch (error) {
      console.error('Failed to unmatch:', error);
      toast.error('Failed to unmatch. Please try again.');
    }
  };

  const getFilteredMatches = () => {
    switch (filter) {
      case 'pending':
        return matches.filter(match => !match.call_completed && match.status === 'pending');
      case 'completed':
        return matches.filter(match => match.call_completed && match.status !== 'matched');
      case 'matched':
        return matches.filter(match => match.status === 'matched');
      default:
        return matches;
    }
  };

  const filteredMatches = getFilteredMatches();

  const getMatchStatusInfo = (match: Match) => {
    if (match.status === 'matched') {
      return {
        color: 'text-green-600 bg-green-100',
        icon: <SparklesIcon className="h-5 w-5" />,
        text: 'Mutual Match',
        description: 'You both liked each other!'
      };
    } else if (match.call_completed) {
      return {
        color: 'text-blue-600 bg-blue-100',
        icon: <CheckCircleIcon className="h-5 w-5" />,
        text: 'Call Completed',
        description: 'Ready to make your decision'
      };
    } else {
      return {
        color: 'text-yellow-600 bg-yellow-100',
        icon: <ClockIcon className="h-5 w-5" />,
        text: 'Pending Call',
        description: 'Ready for video chat'
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-secondary-600">
        <div className="glass-morphism p-8 rounded-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-700 mt-4 text-center">Loading your matches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-secondary-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Link
              to="/dashboard"
              className="flex items-center text-white/80 hover:text-white mr-6 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white">Your Matches</h1>
              <p className="text-white/80">Connect through authentic video conversations</p>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary flex items-center"
          >
            {refreshing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                Refreshing...
              </>
            ) : (
              'Refresh Matches'
            )}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { key: 'all', label: 'All Matches', count: matches.length },
            { key: 'pending', label: 'Pending Calls', count: matches.filter(m => !m.call_completed && m.status === 'pending').length },
            { key: 'completed', label: 'Need Decision', count: matches.filter(m => m.call_completed && m.status !== 'matched').length },
            { key: 'matched', label: 'Mutual Matches', count: matches.filter(m => m.status === 'matched').length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-4 py-2 rounded-full font-medium transition-all duration-200 ${
                filter === tab.key
                  ? 'bg-white text-primary-600 shadow-lg'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Active Users Info */}
        {activeUsers && (
          <div className="glass-morphism rounded-xl p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">🌍 Who's Online</h2>
              <div className="text-sm text-gray-600">
                Matches now prioritize active users!
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-700">{activeUsers.online_now}</div>
                <div className="text-sm text-green-600">🟢 Online Now</div>
                <div className="text-xs text-gray-500">(last 10 min)</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-700">{activeUsers.active_last_hour}</div>
                <div className="text-sm text-yellow-600">🟡 Recently Active</div>
                <div className="text-xs text-gray-500">(last hour)</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-700">{activeUsers.active_today}</div>
                <div className="text-sm text-blue-600">🔵 Active Today</div>
                <div className="text-xs text-gray-500">(last 24 hours)</div>
              </div>
            </div>
            
            {activeUsers.recent_active_users.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-800 mb-3">Recent Active Users:</h3>
                <div className="flex flex-wrap gap-2">
                  {activeUsers.recent_active_users.slice(0, 6).map((user, index) => (
                    <div key={index} className="px-3 py-2 bg-white/50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">{user.status}</span>
                        <span className="font-medium">{user.name}, {user.age}</span>
                        <span className="text-xs text-gray-500">
                          {user.minutes_ago < 1 ? 'now' : `${user.minutes_ago}m ago`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Matches Grid */}
        {filteredMatches.length === 0 ? (
          <div className="text-center py-16">
            <div className="glass-morphism p-8 rounded-2xl max-w-md mx-auto">
              <UserGroupIcon className="h-16 w-16 text-primary-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-800 mb-2">
                {filter === 'all' ? 'No matches yet' : `No ${filter} matches`}
              </h3>
              <p className="text-gray-600 mb-6">
                {filter === 'all' 
                  ? 'Find new matches to start connecting with compatible people!'
                  : `Check back later or switch to a different filter.`
                }
              </p>
              {filter === 'all' && (
                <Link to="/dashboard" className="btn-primary">
                  Find Matches
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((match, index) => {
              const statusInfo = getMatchStatusInfo(match);
              
              return (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-morphism rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-3">
                          <span className="text-lg font-bold">
                            {match.matched_user_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">
                            {match.matched_user_name}, {match.matched_user_age}
                          </h3>
                          <div className="flex items-center text-sm opacity-90">
                            <SparklesIcon className="h-4 w-4 mr-1" />
                            {Math.round(match.compatibility_score * 100)}% compatible
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    {/* Status */}
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 ${statusInfo.color}`}>
                      {statusInfo.icon}
                      <span className="ml-2">{statusInfo.text}</span>
                    </div>

                    {/* Bio */}
                    {match.matched_user_bio && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                        {match.matched_user_bio}
                      </p>
                    )}

                    {/* Interests */}
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-1">
                        {match.matched_user_interests.slice(0, 4).map((interest, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs bg-primary-50 text-primary-700 rounded-full"
                          >
                            {interest}
                          </span>
                        ))}
                        {match.matched_user_interests.length > 4 && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                            +{match.matched_user_interests.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mb-2">
                      {match.status === 'matched' ? (
                        <div className="flex-1 space-y-2">
                          <div className="text-center py-2 px-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
                            <span className="font-medium">🎉 Mutual Match!</span>
                            <p className="text-xs mt-1">
                              {callHistories[match.id] 
                                ? `${callHistories[match.id].total_calls} video calls together`
                                : 'You can video call anytime'
                              }
                            </p>
                          </div>
                          <button
                            onClick={() => handleStartVideoCall(match.id)}
                            className="w-full btn-primary text-sm py-2 flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                          >
                            <VideoCameraIcon className="h-4 w-4 mr-2" />
                            {callHistories[match.id]?.total_calls > 0 ? 'Call Again 💕' : 'Start Video Call 💕'}
                          </button>
                        </div>
                      ) : match.call_completed && match.status !== 'matched' && match.status !== 'rejected' ? (
                        <Link
                          to={`/swipe/${match.id}`}
                          className="flex-1 btn-primary text-center text-sm py-2"
                        >
                          Make Decision
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleStartVideoCall(match.id)}
                          className="flex-1 btn-primary text-sm py-2 flex items-center justify-center"
                        >
                          <VideoCameraIcon className="h-4 w-4 mr-2" />
                          Start Video Call
                        </button>
                      )}
                    </div>

                    {/* Unmatch Button */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => handleUnmatch(match.id, match.matched_user_name)}
                        className="px-3 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors duration-200 flex items-center"
                        title={`Unmatch with ${match.matched_user_name}`}
                      >
                        <XMarkIcon className="h-3 w-3 mr-1" />
                        Unmatch
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {statusInfo.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Pending Calls Notification */}
      <PendingCallsNotification />
    </div>
  );
};

export default MatchingInterface;
