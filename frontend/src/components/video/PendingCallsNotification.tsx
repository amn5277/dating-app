import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { videoAPI } from '../../utils/api';
import toast from 'react-hot-toast';

interface PendingCall {
  session_id: string;
  match_id: number;
  other_user_name: string;
  is_mutual_match: boolean;
  started_at: string;
  seconds_ago: number;
  call_type: string;
}

interface PendingCallsNotificationProps {
  refreshInterval?: number;
}

const PendingCallsNotification: React.FC<PendingCallsNotificationProps> = ({ 
  refreshInterval = 3000 
}) => {
  const navigate = useNavigate();
  const [pendingCalls, setPendingCalls] = useState<PendingCall[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkPendingCalls = async () => {
      try {
        const response = await videoAPI.getPendingCalls();
        const calls = response.data.pending_calls || [];
        
        // Remove duplicates by match_id (keep most recent session per match)
        const uniqueCalls = calls.reduce((unique: PendingCall[], call: PendingCall) => {
          const existingCall = unique.find(c => c.match_id === call.match_id);
          if (!existingCall || call.started_at > existingCall.started_at) {
            // Remove the old call if exists and add the new one
            const filtered = unique.filter(c => c.match_id !== call.match_id);
            filtered.push(call);
            return filtered;
          }
          return unique;
        }, []);
        
        setPendingCalls(uniqueCalls.filter((call: PendingCall) => !dismissed.has(call.session_id)));
      } catch (error) {
        console.error('Failed to check pending calls:', error);
      }
    };

    // Check immediately
    checkPendingCalls();

    // Set up polling
    const interval = setInterval(checkPendingCalls, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, dismissed]);

  const handleJoinCall = (sessionId: string, userName: string, isMutual: boolean) => {
    if (isMutual) {
      toast.success(`💕 Joining call with ${userName}!`, { duration: 2000 });
    } else {
      toast.success(`📞 Joining call with ${userName}!`, { duration: 2000 });
    }
    navigate(`/video-call/${sessionId}`);
  };

  const handleDismiss = (sessionId: string) => {
    setDismissed(prev => {
      const newSet = new Set(prev);
      newSet.add(sessionId);
      return newSet;
    });
  };

  const formatTimeAgo = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  if (pendingCalls.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      {pendingCalls.map((call) => (
        <div
          key={call.session_id}
          className={`mb-3 p-4 rounded-lg shadow-lg border-l-4 animate-bounce ${
            call.is_mutual_match
              ? 'bg-gradient-to-r from-pink-50 to-purple-50 border-pink-500'
              : 'bg-gradient-to-r from-blue-50 to-green-50 border-blue-500'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-full animate-pulse ${
                call.is_mutual_match 
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600' 
                  : 'bg-blue-500'
              }`}>
                <PhoneIcon className="h-4 w-4 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">
                  {call.is_mutual_match ? '💕 Mutual Match Calling!' : '📞 Incoming Call'}
                </h4>
                <p className="text-sm text-gray-700 font-medium">
                  {call.other_user_name}
                </p>
                <p className="text-xs text-gray-500">
                  {call.call_type} • {formatTimeAgo(call.seconds_ago)}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDismiss(call.session_id)}
              className="text-gray-400 hover:text-gray-600 ml-2"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          
          <div className="mt-3 flex space-x-2">
            <button
              onClick={() => handleJoinCall(call.session_id, call.other_user_name, call.is_mutual_match)}
              className={`flex-1 px-4 py-2 rounded-md text-white font-medium transition-all duration-200 transform hover:scale-105 ${
                call.is_mutual_match
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              <PhoneIcon className="h-4 w-4 inline mr-2" />
              Join Call
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingCallsNotification;
