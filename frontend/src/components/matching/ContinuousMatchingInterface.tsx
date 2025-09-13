import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  ArrowRightIcon,
  ArrowLeftIcon
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
  match_id?: number;  // Optional for instant calls
  call_session_id?: number;  // For instant calls
  video_session_id: string;
  user_name: string;
  user_age: number;
  user_bio: string;
  user_interests: string[];
  compatibility_score: number;
  is_actual_match?: boolean;  // Backend sends this for instant calls
}

const ContinuousMatchingInterface: React.FC = () => {
  console.log('🔍 DEBUG: ContinuousMatchingInterface component rendering/re-rendering');
  console.log('🔍 DEBUG: Component render timestamp:', new Date().toISOString());
  
  // Check if we're in React Strict Mode (double execution)
  const renderCount = React.useRef(0);
  renderCount.current += 1;
  console.log('🔍 DEBUG: Component render count:', renderCount.current);
  
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuthStore();
  
  const [isMatching, setIsMatchingInternal] = useState(() => {
    console.log('🔍 DEBUG: Initializing isMatching state to false');
    return false;
  });
  
  // Wrap setIsMatching to track all state changes
  const setIsMatching = React.useCallback((newValue: boolean | ((prev: boolean) => boolean)) => {
    const resolvedValue = typeof newValue === 'function' ? newValue(isMatching) : newValue;
    console.log('🔍 DEBUG: setIsMatching called with:', resolvedValue);
    console.log('🔍 DEBUG: setIsMatching stack trace:', new Error().stack?.split('\n').slice(0, 8));
    setIsMatchingInternal(newValue);
  }, [isMatching]);
  const [matchingSession, setMatchingSession] = useState<MatchingSession | null>(() => {
    console.log('🔍 DEBUG: Initializing matchingSession state to null');
    return null;
  });
  const [currentMatch, setCurrentMatch] = useState<CurrentMatch | null>(null);
  const currentMatchRef = useRef<CurrentMatch | null>(null);
  const [showPreferences, setShowPreferences] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [matchingStats, setMatchingStats] = useState({ matches_made: 0, successful_matches: 0 });
  const [apiCallInProgress, setApiCallInProgress] = useState(false); // 🛡️ Protect against cleanup during API calls
  
  const [preferences, setPreferences] = useState<MatchingPreferences>({
    min_age: 18,
    max_age: 35,
    preferred_interests: [],
    personality_weight: 0.5
  });

  // 🔍 DEBUG: Track critical state changes
  React.useEffect(() => {
    console.log('🔍 DEBUG: isMatching changed to:', isMatching);
  }, [isMatching]);

  React.useEffect(() => {
    console.log('🔍 DEBUG: matchingSession changed to:', matchingSession?.session_id || 'null');
  }, [matchingSession]);

  // Available interests for selection
  const availableInterests = [
    'Travel', 'Music', 'Movies', 'Books', 'Sports', 'Gaming', 'Cooking', 
    'Photography', 'Art', 'Technology', 'Fitness', 'Dancing', 'Hiking',
    'Fashion', 'Food', 'Animals', 'Nature', 'Science', 'History', 'Business'
  ];

  // Use a ref to track the current session for cleanup
  const matchingSessionRef = useRef<MatchingSession | null>(null);
  // Use a ref to store the API call status for reliable cleanup protection  
  const apiCallInProgressRef = useRef(false);
  
  // Update the ref whenever matchingSession changes
  React.useEffect(() => {
    console.log('🔍 DEBUG: matchingSession state changed:', matchingSession?.session_id || 'null');
    console.log('🔍 DEBUG: Current isMatching state:', isMatching);
    matchingSessionRef.current = matchingSession;
  }, [matchingSession]);

  // Update the current match ref whenever currentMatch changes
  React.useEffect(() => {
    console.log('🔍 DEBUG: currentMatch state changed:', currentMatch?.video_session_id || 'null');
    currentMatchRef.current = currentMatch;
  }, [currentMatch]);

  // Update the API call protection ref whenever apiCallInProgress changes
  React.useEffect(() => {
    apiCallInProgressRef.current = apiCallInProgress;
  }, [apiCallInProgress]);

  // Track isMatching state changes
  React.useEffect(() => {
    console.log('🔍 DEBUG: isMatching state changed:', isMatching);
    console.log('🔍 DEBUG: Stack trace for isMatching change:', new Error().stack?.split('\n').slice(0, 5));
  }, [isMatching]);

  // Cleanup on component unmount ONLY
  useEffect(() => {
    console.log('🔍 DEBUG: Component mounted - setting up unmount cleanup');
    
    return () => {
      console.log('🔍 DEBUG: Component unmounting - running cleanup');
      console.log('🔍 DEBUG: Unmount cleanup stack trace:', new Error().stack?.split('\n').slice(0, 10));
      
      const sessionToCleanup = matchingSessionRef.current;
      if (sessionToCleanup?.session_id) {
        // 🛡️ CRITICAL FIX: Don't end session if navigating to video call!
        const hasVideoTransition = currentMatchRef.current?.video_session_id;
        const isNavigatingToVideoCall = window.location.pathname.includes('/video-call/');
        const recentMatch = (window as any).lastMatchTimestamp && Date.now() - (window as any).lastMatchTimestamp < 30000;
        const globalVideoTransition = (window as any).videoCallTransitionActive;
        
        console.log('🔍 UNMOUNT CLEANUP CHECK:', {
          sessionId: sessionToCleanup.session_id,
          hasVideoTransition: !!hasVideoTransition,
          isNavigatingToVideoCall,
          recentMatch,
          globalVideoTransition,
          pathname: window.location.pathname,
          lastMatchTimestamp: (window as any).lastMatchTimestamp
        });
        
        if (hasVideoTransition || isNavigatingToVideoCall || recentMatch || globalVideoTransition) {
          console.log('🛡️  PROTECTED: Not ending session on unmount - video call transition detected');
          console.log('🛡️  Protection reasons:', {
            hasVideoTransition: !!hasVideoTransition,
            isNavigatingToVideoCall,
            recentMatch,
            globalVideoTransition,
            videoSessionId: hasVideoTransition
          });
        } else {
          console.log('🧹 Cleaning up matching session on unmount:', sessionToCleanup.session_id);
          // Use regular API call with auth headers instead of sendBeacon
          continuousMatchingAPI.endSession(sessionToCleanup.session_id)
            .catch(error => console.error('Failed to cleanup session on unmount:', error));
        }
      } else {
        console.log('🔍 DEBUG: Component cleanup - no session to end');
      }
    };
  }, []); // Empty dependency array = only runs on mount/unmount

  // Handle URL parameters from video call returns
  useEffect(() => {
    console.log('🔍 URL PARAMS useEffect TRIGGERED - checking searchParams...');
    
    const action = searchParams.get('action');
    const skippedMatchId = searchParams.get('skipped_match');  
    const sessionId = searchParams.get('session_id');
    const allParams = Object.fromEntries(searchParams.entries());
    
    console.log('🔍 DEBUG: URL parameters on ContinuousMatchingInterface load:', { action, skippedMatchId, sessionId });
    console.log('🔍 DEBUG: ALL URL parameters:', allParams);
    console.log('🔍 DEBUG: Current URL:', window.location.href);
    console.log('🔍 DEBUG: searchParams object:', searchParams);
    console.log('🔍 DEBUG: searchParams toString:', searchParams.toString());
    
    // ✅ FORCE CHECK: Also try window.location.search directly
    const urlSearchParams = new URLSearchParams(window.location.search);
    const directAction = urlSearchParams.get('action');
    const directSkippedMatchId = urlSearchParams.get('skipped_match');
    const directSessionId = urlSearchParams.get('session_id');
    
    console.log('🔍 DIRECT URL PARAMS:', { 
      directAction, 
      directSkippedMatchId, 
      directSessionId,
      windowLocationSearch: window.location.search 
    });
    
    const finalAction = action || directAction;
    const finalSessionId = sessionId || directSessionId;
    const finalSkippedMatchId = skippedMatchId || directSkippedMatchId;
    
    console.log('🔍 FINAL RESOLVED PARAMS:', { 
      finalAction, 
      finalSessionId, 
      finalSkippedMatchId 
    });
    
    if (finalAction && finalSessionId) {
      console.log('✅ TRIGGERING: handleReturnFromVideoCall with action:', finalAction);
      handleReturnFromVideoCall(finalAction, finalSessionId, finalSkippedMatchId);
      // Clear URL parameters after handling
      setSearchParams({});
    } else {
      if (!finalAction && !finalSessionId) {
        console.log('⚠️ NO ACTION/SESSION: User navigated to continuous matching without return parameters');
      } else {
        console.log('⚠️ PARTIAL PARAMS: Missing required parameters -', { 
          action: !!finalAction, 
          sessionId: !!finalSessionId 
        });
      }
    }
  }, [searchParams]);

  const handleReturnFromVideoCall = async (action: string, sessionId: string, skippedMatchId: string | null) => {
    console.log('🔄 Handling return from video call:', { action, sessionId, skippedMatchId });
    
    try {
      // If user was skipped (they left during the call), record the skip decision
      if (action === 'skip' && skippedMatchId) {
        console.log('📝 Recording skip decision for user who left:', skippedMatchId);
        console.log('📝 Skip decision payload:', {
          session_id: sessionId,
          match_id: parseInt(skippedMatchId),
          decision: 'skip'
        });
        
        try {
          const skipResponse = await continuousMatchingAPI.handleDecision({
            session_id: sessionId,
            match_id: parseInt(skippedMatchId),
            decision: 'skip'
          });
          
          console.log('✅ Skip decision recorded successfully:', skipResponse.data);
          toast('⏭️ User left - looking for your next match...', { 
            icon: '🔄',
            duration: 3000 
          });
        } catch (error: any) {
          console.error('❌ Failed to record skip decision:', error);
          console.error('❌ Skip decision error details:', error.response?.data || error.message);
          console.error('❌ This means the user who left may appear in future matches!');
          
          // Continue anyway - don't block the flow, but show warning
          toast.error('⚠️ Could not exclude user - they may appear again', { 
            duration: 4000 
          });
        }
      }
      
      // Resume the matching session if it exists
      try {
        console.log('🔍 ATTEMPTING to resume matching session:', sessionId);
        const sessionResponse = await continuousMatchingAPI.getSession(sessionId);
        console.log('✅ SESSION RESUME response:', sessionResponse.data);
        
        if (sessionResponse.data && sessionResponse.data.status === 'active') {
          console.log('🔄 Resuming existing matching session:', sessionId);
          console.log('📊 Session data:', {
            session_id: sessionResponse.data.session_id,
            status: sessionResponse.data.status,
            matched_user_ids: sessionResponse.data.matched_user_ids,
            matches_made: sessionResponse.data.matches_made
          });
          
          setMatchingSession(sessionResponse.data);
          setIsMatching(true);
          
          // Automatically start looking for next match
          setTimeout(() => {
            console.log('🔍 Auto-starting next match search after return from call');
            getNextMatch(sessionId);
          }, 1000);
        } else {
          console.log('⚠️ Previous session no longer active:', sessionResponse.data);
          console.log('⚠️ Session status:', sessionResponse.data?.status);
          toast('⚠️ Previous session expired - please start a new matching session');
        }
      } catch (error: any) {
        console.error('❌ Failed to resume matching session:', error);
        console.error('❌ Resume error details:', error.response?.data || error.message);
        console.error('❌ Error status:', error.response?.status);
        toast.error('Failed to resume matching session');
      }
      
    } catch (error) {
      console.error('Failed to handle return from video call:', error);
      toast.error('Failed to resume matching');
    }
  };

  // Keep matching session active with periodic heartbeat
  useEffect(() => {
    if (!matchingSession?.session_id) return;

    const heartbeatInterval = setInterval(async () => {
      try {
        // Getting next match will update the last_active timestamp
        // But only if we're not currently in a call
        if (!currentMatch?.video_session_id && !apiCallInProgress) {
          console.log('💓 Sending heartbeat to keep session active');
          console.log('💓 DEBUG: Heartbeat state check - isMatching:', isMatching, 'session:', matchingSession?.session_id);
          await continuousMatchingAPI.getSession(matchingSession.session_id);
          console.log('💓 DEBUG: Heartbeat completed successfully');
        } else if (apiCallInProgress) {
          console.log('💓 SKIPPED: Heartbeat skipped - API call in progress');
        } else {
          console.log('💓 SKIPPED: Heartbeat skipped - currently in video call');
        }
      } catch (error: any) {
        console.error('❌ Heartbeat failed:', error);
        console.error('💓 DEBUG: Heartbeat error details:', error.response?.data || error.message);
        
        // 🚨 CRITICAL: If heartbeat fails due to session not found, don't reset state during API calls or video transitions
        if (error.response?.status === 404 && !apiCallInProgress && !currentMatch?.video_session_id && !currentMatchRef.current?.video_session_id) {
          console.log('🚨 Session not found in heartbeat - cleaning up frontend state');
          console.log('🔍 DEBUG: Heartbeat cleanup state check:', { 
            apiCallInProgress, 
            currentMatch: currentMatch?.video_session_id,
            currentMatchRef: currentMatchRef.current?.video_session_id,
            isMatching 
          });
          console.log('🔄 CLEARING STATE: setIsMatching(false), setMatchingSession(null), setCurrentMatch(null)');
          setIsMatching(false);
          setMatchingSession(null);
          setCurrentMatch(null);
        } else if (apiCallInProgress) {
          console.log('🛡️  PROTECTED: Not resetting state due to heartbeat failure - API call in progress');
        } else if (currentMatch?.video_session_id) {
          console.log('🛡️  PROTECTED: Not resetting state - video call transition in progress (currentMatch)');
        } else if (currentMatchRef.current?.video_session_id) {
          console.log('🛡️  PROTECTED: Not resetting state - video call transition in progress (currentMatchRef)');
        }
      }
    }, 4 * 1000); // Every 4 seconds for real-time matching (8-second backend window)

    return () => clearInterval(heartbeatInterval);
  }, [matchingSession?.session_id, currentMatch?.video_session_id, apiCallInProgress, isMatching, currentMatchRef.current?.video_session_id]);

  // Cleanup on browser close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (matchingSession?.session_id) {
        // 🛡️ PROTECTION: Don't end session if in video call transition
        const hasVideoTransition = currentMatchRef.current?.video_session_id;
        const recentMatch = (window as any).lastMatchTimestamp && Date.now() - (window as any).lastMatchTimestamp < 30000;
        const globalVideoTransition = (window as any).videoCallTransitionActive;
        
        console.log('📤 BEFOREUNLOAD: Checking if session should be ended on browser close/refresh');
        console.log('🔍 BEFOREUNLOAD CHECK:', {
          sessionId: matchingSession.session_id,
          hasVideoTransition: !!hasVideoTransition,
          recentMatch,
          globalVideoTransition,
          pathname: window.location.pathname
        });
        
        // Only end session if not in video call transition
        if (!hasVideoTransition && !recentMatch && !globalVideoTransition) {
          console.log('🧹 BEFOREUNLOAD: Ending session due to browser close/refresh');
          // Use regular API call with auth headers instead of sendBeacon
          continuousMatchingAPI.endSession(matchingSession.session_id)
            .catch(error => console.error('Failed to cleanup session during beforeunload:', error));
        } else {
          console.log('🛡️  BEFOREUNLOAD PROTECTED: Not ending session - video call transition detected');
        }
      }
    };

    const handleVisibilityChange = () => {
      const currentSession = matchingSessionRef.current;
      if (document.visibilityState === 'hidden' && currentSession?.session_id) {
        console.log('👁️  Visibility changed to hidden - starting cleanup timer with extra protection');
        
        // User switched tabs or minimized - clean up after a delay
        setTimeout(async () => {
          // 🛡️  ENHANCED PROTECTION: Check multiple conditions before cleanup
          if (document.visibilityState === 'hidden' && 
              !apiCallInProgressRef.current && 
              document.visibilityState === 'hidden') { // Double-check visibility
            
            // 🛡️  ADDITIONAL PROTECTION: Check if user came back quickly
            const stillHidden = await new Promise<boolean>(resolve => {
              setTimeout(() => resolve(document.visibilityState === 'hidden'), 2000);
            });
            
            // ✅ CRITICAL FIX: Check for video call navigation - don't cleanup if navigating to video call!
            const hasVideoTransition = currentMatchRef.current?.video_session_id;
            const isInVideoCall = window.location.pathname.includes('/video-call/');
            const recentMatch = Date.now() - (window as any).lastMatchTimestamp < 30000; // Within last 30 seconds
            const globalVideoTransition = (window as any).videoCallTransitionActive;
            
            console.log('🔍 VISIBILITY CLEANUP CHECK:', {
              stillHidden,
              apiInProgress: apiCallInProgressRef.current,
              hasVideoTransition,
              isInVideoCall,
              recentMatch,
              globalVideoTransition,
              pathname: window.location.pathname,
              sessionId: currentSession.session_id
            });
            
            // 🚫 DON'T cleanup if any of these conditions are true:
            // - User is in a video call
            // - Video call transition is happening  
            // - Recent match found (within 30 seconds)
            // - Global video transition flag is active
            if (stillHidden && !apiCallInProgressRef.current && !hasVideoTransition && !isInVideoCall && !recentMatch && !globalVideoTransition) {
              try {
                console.log('🧹 CONFIRMED TAB SWITCH: Session cleanup due to confirmed tab switch/minimize:', currentSession.session_id);
                console.log('🧹 DEBUG: All conditions met for cleanup');
                await continuousMatchingAPI.endSession(currentSession.session_id);
                
                // Reset frontend state to prevent desync
                console.log('🔄 Syncing frontend state after backend cleanup');
                setIsMatching(false);
                setMatchingSession(null);
                setCurrentMatch(null);
              } catch (error) {
                console.error('Failed to cleanup session on visibility change:', error);
              }
            } else {
              console.log('🛡️  PROTECTED: Not cleaning up session due to video call or recent match activity');
              console.log('🛡️  Protection reasons:', {
                hasVideoTransition: !!hasVideoTransition,
                isInVideoCall,
                recentMatch,
                globalVideoTransition,
                apiInProgress: apiCallInProgressRef.current
              });
            }
          } else {
            console.log('🛡️  PROTECTED: Not cleaning up session - visibility restored or API in progress');
          }
        }, 15000); // Increased to 15 seconds to give more time for video navigation
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
      
      console.log('🔍 DEBUG: Setting matching session and state...');
      setMatchingSession(session);
      setIsMatching(true);
      setMatchingStats({ matches_made: 0, successful_matches: 0 });
      
      console.log('🔍 DEBUG: State set - session:', session.session_id, 'isMatching: true');
      toast.success('🎯 Searching for someone to connect with...');
      
      // 🚨 CRITICAL FIX: Use ref to avoid closure issues with setTimeout
      setTimeout(async () => {
        console.log('🔍 DEBUG: Starting initial getNextMatch with guaranteed state...');
        console.log('🔍 DEBUG: Ref-based state check - matchingSessionRef:', matchingSessionRef.current?.session_id);
        
        // Double-check state using ref (not closure)
        const currentSession = matchingSessionRef.current;
        if (currentSession?.session_id === session.session_id) {
          console.log('✅ State verified via ref - proceeding with getNextMatch');
      await getNextMatch(session.session_id);
        } else {
          console.log('❌ State mismatch detected - session may have been reset');
          console.log('  Expected:', session.session_id);
          console.log('  Current:', currentSession?.session_id);
        }
      }, 100); // Small delay to ensure state is updated
      
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
    let matchFound = false; // Track if match was found for finally block
    
    try {
      setIsLoading(true);
      setApiCallInProgress(true); // 🛡️ Mark API call as in progress to prevent cleanup
      console.log('🔍 DEBUG: Frontend calling getNextMatch for session:', sessionId);
      console.log('🔍 DEBUG: Frontend state before API call - isMatching:', isMatching, 'matchingSession:', matchingSession?.session_id);
      console.log('🛡️  DEBUG: API call protection activated - preventing cleanup during API call');
      
      // 🚨 CRITICAL DEBUG: Store state before API call to detect changes
      // Use refs to avoid closure issues
      const currentIsMatching = isMatching; // Current closure value
      const currentMatchingSession = matchingSession; // Current closure value
      const refIsMatching = matchingSessionRef.current ? true : false; // Ref-based value
      const refSessionId = matchingSessionRef.current?.session_id || null; // Ref-based value
      
      console.log('🔍 DEBUG: State source comparison:');
      console.log('  📊 Closure-based: isMatching:', currentIsMatching, 'session:', currentMatchingSession?.session_id || null);
      console.log('  📊 Ref-based: isMatching:', refIsMatching, 'session:', refSessionId);
      
      const stateBeforeCall = {
        isMatching: currentIsMatching,
        matchingSession: currentMatchingSession?.session_id || null
      };
      
      const response = await continuousMatchingAPI.getNextMatch(sessionId);
      const nextMatchData = response.data;
      console.log('🔍 DEBUG: Frontend received API response:', nextMatchData);
      console.log('🔍 DEBUG: Match found in response:', nextMatchData.match_found);
      console.log('🔍 DEBUG: Match data in response:', nextMatchData.match_data);
      
      // 🚨 CRITICAL DEBUG: Check if state changed during API call
      const stateAfterCall = {
        isMatching: isMatching,
        matchingSession: matchingSession?.session_id || null
      };
      
      console.log('🔍 DEBUG: State comparison:');
      console.log('  📊 Before API call:', stateBeforeCall);
      console.log('  📊 After API call:', stateAfterCall);
      console.log('  ⚠️  State changed during API call:', 
        stateBeforeCall.isMatching !== stateAfterCall.isMatching || 
        stateBeforeCall.matchingSession !== stateAfterCall.matchingSession);
      
      console.log('🔍 DEBUG: Current frontend state after API call - isMatching:', isMatching, 'matchingSession exists:', !!matchingSession);
      
      // 🚨 EMERGENCY FAILSAFE: If state was incorrectly reset during API call, restore it
      if ((stateBeforeCall.isMatching && !isMatching) || (stateBeforeCall.matchingSession && !matchingSession)) {
        console.log('🚨 EMERGENCY FAILSAFE: State was incorrectly reset during API call - restoring!');
        console.log('  🔄 Restoring isMatching to:', stateBeforeCall.isMatching);
        console.log('  🔄 Restoring session ID:', stateBeforeCall.matchingSession);
        
        if (!isMatching && stateBeforeCall.isMatching) {
          setIsMatching(true);
        }
        
        if (!matchingSession && stateBeforeCall.matchingSession) {
          // We can't fully restore the session object, but we can keep the session alive
          console.log('⚠️  Cannot restore full session object - session may need to be restarted');
          // Don't restore session here as it would cause issues - let it end naturally
        }
      }
      
      setMatchingStats(nextMatchData.session_stats);
      
      if (nextMatchData.match_found && nextMatchData.match_data) {
        matchFound = true; // Set flag for finally block
        console.log('🎯 MATCH FOUND! Processing match data...');
        console.log('🔍 DEBUG: Match data details:', JSON.stringify(nextMatchData.match_data, null, 2));
        
        // 🕐 TIMESTAMP: Record when match was found to prevent visibility cleanup during video navigation
        (window as any).lastMatchTimestamp = Date.now();
        (window as any).videoCallTransitionActive = true; // Global flag for video call transition
        console.log('🕐 MATCH TIMESTAMP: Recorded match timestamp to prevent session cleanup during video navigation');
        console.log('🎥 VIDEO TRANSITION: Set global flag to prevent premature session cleanup');
        
        // 🎯 SAFETY CHECK: Only auto-connect if user is still actively matching
        // This prevents auto-connection if user stopped matching but request was in flight
        console.log('🔍 DEBUG: Starting safety check...');
        
        // 🚨 CRITICAL FIX: Use refs instead of closure values for safety check
        const refMatchingSession = matchingSessionRef.current;
        const refIsMatching = refMatchingSession ? true : false;
        
        console.log('🔍 DEBUG: Safety check values:');
        console.log('  📊 Closure-based: isMatching:', isMatching, 'matchingSession:', matchingSession?.session_id);
        console.log('  📊 Ref-based: isMatching:', refIsMatching, 'matchingSession:', refMatchingSession?.session_id);
        console.log('  🔍 Session ID param:', sessionId);
        
        // Use ref-based values for safety check decision  
        if (!refIsMatching || !refMatchingSession || refMatchingSession.session_id !== sessionId) {
          console.log('🚫 SAFETY CHECK FAILED (REF-BASED) - User stopped matching - not auto-connecting to video call');
          console.log('🔍 DEBUG: Failed because:');
          console.log('  📊 refIsMatching:', refIsMatching);
          console.log('  📊 refMatchingSession exists:', !!refMatchingSession);
          console.log('  📊 Session ID match:', refMatchingSession?.session_id === sessionId);
          
          matchFound = false; // Reset flag since we're not proceeding with video call
          toast.error('⚠️ Matching session expired - please start a new session', {
            duration: 4000
          });
          return;
        }
        console.log('✅ SAFETY CHECK PASSED (REF-BASED) - proceeding with auto-connection');
        
        console.log('🔍 DEBUG: Frontend received match data:', nextMatchData.match_data);
        console.log('🔍 DEBUG: Video session ID:', nextMatchData.match_data.video_session_id);
        console.log('🔍 DEBUG: Current matching session:', matchingSession?.session_id);
        
        console.log('🔍 DEBUG: Setting currentMatch state...');
        setCurrentMatch(nextMatchData.match_data);
        
        console.log('🔍 DEBUG: Showing success toast...');
        toast.success(`🚀 ${nextMatchData.message || 'Instant match! Connecting to video call...'}`);
        
        // ✅ FIX: Store match data and session data in variables to preserve across state changes
        const preservedMatchData = nextMatchData.match_data;
        const preservedSessionId = matchingSession?.session_id || matchingSessionRef.current?.session_id;
        
        console.log('🔍 DEBUG: Preserved data for video call transition:', {
          matchData: preservedMatchData,
          sessionId: preservedSessionId,
          videoSessionId: preservedMatchData.video_session_id
        });
        
        // Immediately start video call for seamless connection
        console.log('🔍 DEBUG: Scheduling video call start in 500ms...');
        console.log('🛡️  DEBUG: Keeping API call protection ACTIVE during video call transition');
        
        setTimeout(() => {
          console.log('🚀 Frontend: Match found: true, connecting to video...');
          console.log('🔍 DEBUG: Calling startVideoCall with session ID:', preservedMatchData.video_session_id);
          console.log('🔍 DEBUG: State check before video call:', {
            currentMatch: currentMatch?.video_session_id,
            currentMatchRef: currentMatchRef.current?.video_session_id,
            matchingSession: matchingSession?.session_id,
            matchingSessionRef: matchingSessionRef.current?.session_id,
            preservedData: {
              matchData: preservedMatchData.video_session_id,
              sessionId: preservedSessionId
            }
          });
          
          startVideoCall(preservedMatchData.video_session_id, preservedSessionId, preservedMatchData);
          
          // ✅ FIX: Clear API protection AFTER starting video call
          setApiCallInProgress(false);
          console.log('🛡️  DEBUG: API call protection deactivated AFTER video call start');
        }, 500);
        
      } else {
        // Continue searching silently - no toast notifications for better UX
        console.log('⏳ No match found, trying again...');
        
        // 🎯 SAFETY CHECK: Only continue polling if user is still actively matching
        // 🚨 CRITICAL FIX: Use refs to avoid closure issues
        const refMatchingSession = matchingSessionRef.current;
        const refIsMatching = refMatchingSession ? true : false;
        
        console.log('🔍 DEBUG: Polling continuation check:');
        console.log('  📊 Closure-based: isMatching:', isMatching, 'matchingSession:', matchingSession?.session_id);
        console.log('  📊 Ref-based: isMatching:', refIsMatching, 'matchingSession:', refMatchingSession?.session_id);
        console.log('  🔍 Session ID param:', sessionId);
        
        // Use ref-based values for decision making
        if (refIsMatching && refMatchingSession && refMatchingSession.session_id === sessionId) {
          // Try again with ultra-fast interval for real-time matching (8-second backend window)
          console.log('✅ Continuing search loop - no match found but still actively matching (REF-BASED)');
        setTimeout(() => {
          getNextMatch(sessionId);
          }, 2000); // 2 seconds - ultra-fast polling for 8-second backend window
        } else {
          console.log('🚫 User stopped matching - ending search loop (REF-BASED)');
          console.log('🔍 DEBUG: Why ending?');
          console.log('  📊 refIsMatching:', refIsMatching);
          console.log('  📊 refMatchingSession exists:', !!refMatchingSession);
          console.log('  📊 Session ID match:', refMatchingSession?.session_id === sessionId);
        }
      }
      
    } catch (error: any) {
      console.error('❌ FRONTEND ERROR: Failed to get next match:', error);
      console.error('🔍 DEBUG: Error details:', error.response?.data || error.message);
      console.error('🔍 DEBUG: Error status:', error.response?.status);
      console.error('🔍 DEBUG: Full error object:', error);
      
      // 🎯 SAFETY CHECK: Only retry if user is still actively matching
      // 🚨 CRITICAL FIX: Use refs to avoid closure issues
      const refMatchingSession = matchingSessionRef.current;
      const refIsMatching = refMatchingSession ? true : false;
      
      console.log('🔄 ERROR RETRY: Ref-based state check:', refIsMatching, refMatchingSession?.session_id);
      
      if (refIsMatching && refMatchingSession && refMatchingSession.session_id === sessionId) {
        console.log('🔄 Retrying getNextMatch after error (REF-BASED)...');
        // Retry after shorter delay for real-time matching
      setTimeout(() => {
        getNextMatch(sessionId);
        }, 3000); // 3 seconds retry for real-time system
      } else {
        console.log('🚫 User stopped matching - not retrying after error (REF-BASED)');
      }
    } finally {
      setIsLoading(false);
      
      // ✅ FIX: Only clear API protection if we're not transitioning to video call
      if (!matchFound) {
        setApiCallInProgress(false); // 🛡️ Clear API call protection
        console.log('🛡️  DEBUG: API call protection deactivated - cleanup allowed again');
      } else {
        console.log('🛡️  DEBUG: API call protection KEPT ACTIVE - video call transition in progress');
      }
    }
  };

  const startVideoCall = (videoSessionId: string, preservedSessionId?: string, preservedMatchData?: any) => {
    console.log('🎥 Starting video call with session ID:', videoSessionId);
    console.log('🔍 DEBUG: Parameters received:', { videoSessionId, preservedSessionId, preservedMatchData });
    console.log('🔍 DEBUG: Current match data:', currentMatch);
    console.log('🔍 DEBUG: Current match ref:', currentMatchRef.current);
    console.log('🔍 DEBUG: Matching session ID:', matchingSession?.session_id);
    console.log('🔍 DEBUG: Matching session ref:', matchingSessionRef.current?.session_id);
    console.log('🔍 DEBUG: Matching session object:', matchingSession);
    
    // ✅ FIX: Use preserved data first, then fallback to current state/refs
    const matchData = preservedMatchData || currentMatch || currentMatchRef.current;
    const callId = matchData?.match_id || matchData?.call_session_id || 0;
    
    // ✅ FIX: Try multiple sources for session ID with preserved data priority
    let sessionIdForUrl = preservedSessionId || matchingSession?.session_id || matchingSessionRef.current?.session_id;
    
    console.log('🔍 DEBUG: Resolved data for URL construction:', {
      matchData,
      callId,
      sessionIdForUrl,
      sources: {
        sessionId: preservedSessionId ? 'preserved' : matchingSession?.session_id ? 'current state' : 'ref backup',
        matchData: preservedMatchData ? 'preserved' : currentMatch ? 'current state' : 'ref backup'
      }
    });
    
    if (!sessionIdForUrl) {
      console.error('❌ CRITICAL: No matching session ID available for continuous matching!');
      console.error('❌ preservedSessionId:', preservedSessionId);
      console.error('❌ matchingSession:', matchingSession);
      console.error('❌ matchingSessionRef:', matchingSessionRef.current);
      console.error('❌ This will cause continuousSessionId to be undefined in VideoCall');
      toast.error('Session error - unable to start video call. Please restart matching.');
      setApiCallInProgress(false); // Clear protection since we're not navigating
      return; // Don't navigate if no session ID
    }
    
    // Navigate to video call with special continuous matching flag
    const url = `/video-call/${videoSessionId}?continuous=true&session_id=${sessionIdForUrl}&match_id=${callId}`;
    console.log('🔍 DEBUG: Navigating to URL:', url);
    console.log('🔍 DEBUG: sessionIdForUrl value:', sessionIdForUrl);
    console.log('🔍 DEBUG: Final URL components:', { videoSessionId, sessionIdForUrl, callId });
    navigate(url);
  };

  const handleStopMatching = async () => {
    console.log('🔍 DEBUG: handleStopMatching called');
    console.log('🔍 DEBUG: Stack trace:', new Error().stack);
    
    // 🛡️ PROTECTION: Don't stop matching if API call is processing a match response
    if (apiCallInProgress) {
      console.log('🛡️  PROTECTED: Cannot stop matching - API call processing match response');
      toast.loading('Please wait - processing match response...');
      return;
    }
    
    if (!matchingSession) {
      console.log('🔍 DEBUG: No matching session to stop');
      return;
    }
    
    try {
      console.log('🔍 DEBUG: Stopping matching session:', matchingSession.session_id);
      
      // 🛡️ SAFETY: Store session ID before clearing state
      const sessionToStop = matchingSession.session_id;
      
      await continuousMatchingAPI.endSession(sessionToStop);
      
      console.log('🔍 DEBUG: Successfully stopped backend session - now clearing frontend state');
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
        
        {/* Navigation & Header */}
        <div className="mb-8">
          {/* Back Button */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors duration-200 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Back to Dashboard</span>
            </button>
            
            {isMatching && (
              <button
                onClick={handleStopMatching}
                className="flex items-center space-x-2 text-white/80 hover:text-white transition-colors duration-200 bg-red-500/20 hover:bg-red-500/30 px-4 py-2 rounded-xl backdrop-blur-sm"
              >
                <XMarkIcon className="h-5 w-5" />
                <span>Stop Matching</span>
              </button>
            )}
          </div>

          {/* Header */}
          <div className="text-center">
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
                    🎯 Instant connections with active users
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

              {/* Looking for Match Animation */}
              <div className="glass-morphism rounded-2xl p-8 text-center">
                <div className="relative">
                  {/* Animated Searching Visual */}
                  <div className="relative w-32 h-32 mx-auto mb-6">
                    {/* Outer ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-primary-200 animate-ping"></div>
                    {/* Middle ring */}
                    <div className="absolute inset-2 rounded-full border-4 border-purple-300 animate-pulse"></div>
                    {/* Inner circle */}
                    <div className="absolute inset-6 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center">
                      <div className="animate-bounce">
                        <UserGroupIcon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    
                    {/* Floating dots */}
                    <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                  
                  <motion.h3 
                    animate={{ opacity: [1, 0.6, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-2xl font-bold text-gray-800 mb-3"
                  >
                    🔍 Looking for your match...
                  </motion.h3>
                  
                  <motion.p 
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="text-gray-600 mb-4"
                  >
                    {currentMatch ? 'Match found! Connecting to video call...' : 'Searching for someone online right now...'}
                  </motion.p>
                  
                  {/* Fun animated messages */}
                  <div className="space-y-2 text-sm text-gray-500">
                    <motion.div
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 4, repeat: Infinity, delay: 0 }}
                    >
                      ✨ Finding someone awesome for you...
                    </motion.div>
                    <motion.div
                      animate={{ opacity: [0, 1, 0] }}
                      transition={{ duration: 4, repeat: Infinity, delay: 2 }}
                    >
                      💫 Your perfect match might be just seconds away...
                    </motion.div>
                  </div>
                </div>
              </div>

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
