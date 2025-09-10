import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  MicrophoneIcon,
  VideoCameraIcon,
  PhoneXMarkIcon,
  SpeakerWaveIcon,
  VideoCameraSlashIcon,
  SpeakerXMarkIcon
} from '@heroicons/react/24/outline';

import { videoAPI, continuousMatchingAPI, matchingAPI } from '../../utils/api';
import { useAuthStore } from '../../store/auth';
import PostCallDecisionPopup from '../matching/PostCallDecisionPopup';

interface VideoSessionData {
  id: number;
  session_id: string;
  match_id: number;
  started_at?: string;
  ended_at?: string;
  duration: number;
  status: string;
}

const VideoCall: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  // Continuous matching parameters
  const isContinuousMatching = searchParams.get('continuous') === 'true';
  const continuousSessionId = searchParams.get('session_id');
  const matchId = searchParams.get('match_id');
  
  // Video elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // WebRTC
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const signalingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionMonitorRef = useRef<NodeJS.Timeout | null>(null);
  
  // State
  const [sessionData, setSessionData] = useState<VideoSessionData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [callEndedByMe, setCallEndedByMe] = useState(false);
  const [callEndedByOther, setCallEndedByOther] = useState(false);
  
  // Continuous matching state
  const [showDecisionPopup, setShowDecisionPopup] = useState(false);
  const [matchData, setMatchData] = useState<any>(null);
  
  useEffect(() => {
    console.log('🎬 VideoCall component mounted with session:', sessionId);
    
    if (sessionId) {
      initializeCall();
    }
    
    return () => {
      console.log('🏁 VideoCall component unmounting - running cleanup');
      cleanup();
    };
  }, [sessionId]);

  // Timer effect
  useEffect(() => {
    if (isCallStarted && timeLeft > 0 && !callEndedByMe && !callEndedByOther) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            console.log('⏰ Timer expired - ending call');
            endCall(true); // Pass true to indicate timer expired
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isCallStarted, timeLeft, callEndedByMe, callEndedByOther]);

  const initializeCall = async () => {
    try {
      // Get session data
      if (!sessionId) return;
      
      const response = await videoAPI.getSession(sessionId);
      setSessionData(response.data);
      
      // Setup WebRTC
      await setupWebRTC();
      
      // Start signaling
      startSignaling();
      
      // Join the call - this will start timer only when both users are connected
      console.log('📞 Calling joinCall API to mark user as joined...');
      const joinResponse = await videoAPI.joinCall(sessionId);
      console.log('📞 Join response:', joinResponse.data);
      
      if (joinResponse.data.timer_started) {
        console.log('🎉 Both users connected! Timer started.');
        setIsCallStarted(true);
        toast.success('Video call started! Both users connected.');
        // Start session monitoring for real-time call termination
        startSessionMonitoring();
      } else {
        console.log('⏳ Waiting for other user to join...');
        setIsCallStarted(false);
        toast('Waiting for the other user to join...', { icon: '⏳' });
        
        // Poll for the other user to join
        const checkOtherUser = setInterval(async () => {
          try {
            const checkResponse = await videoAPI.getSession(sessionId);
            if (checkResponse.data.status === 'active') {
              console.log('🎉 Other user joined! Starting timer.');
              setIsCallStarted(true);
              toast.success('Other user joined! Video call started.');
              clearInterval(checkOtherUser);
              // Start session monitoring for real-time call termination
              startSessionMonitoring();
            }
          } catch (error) {
            console.error('Error checking for other user:', error);
          }
        }, 2000);
        
        // Clear interval after 2 minutes if no one joins
        setTimeout(() => {
          clearInterval(checkOtherUser);
        }, 120000);
      }
    } catch (error: any) {
      console.error('Failed to initialize call:', error);
      
      // Handle different types of errors with specific messages
      if (error.message?.includes('HTTPS_REQUIRED')) {
        toast.error('🔒 HTTPS Required: Camera access needs HTTPS for network connections. Please use localhost or enable HTTPS.', { duration: 8000 });
      } else if (error.message?.includes('Permission denied') || error.name === 'NotAllowedError') {
        toast.error('📷 Camera/Microphone Access Denied: Please allow camera and microphone access and try again.', { duration: 6000 });
      } else if (error.message?.includes('getUserMedia')) {
        toast.error('🎥 Media Access Error: Unable to access camera/microphone. Check browser permissions.', { duration: 6000 });
      } else if (error.response?.status === 404) {
        toast.error('❌ Video session not found. Please start a new call.', { duration: 5000 });
      } else if (error.response?.status >= 500) {
        toast.error('🔧 Server Error: Please try again in a moment.', { duration: 5000 });
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        toast.error('🌐 Network Error: Check your internet connection and backend server.', { duration: 6000 });
      } else {
        toast.error(`❌ Failed to initialize video call: ${error.message || 'Unknown error'}`, { duration: 5000 });
      }
      
      navigate('/dashboard');
    }
  };

  const startSessionMonitoring = () => {
    console.log('🔍 Starting session monitoring for real-time call termination...');
    
    if (sessionMonitorRef.current) {
      clearInterval(sessionMonitorRef.current);
    }
    
    sessionMonitorRef.current = setInterval(async () => {
      if (callEndedByMe || callEndedByOther || !sessionId) {
        return; // Don't monitor if call already ended
      }
      
      try {
        const response = await videoAPI.getSession(sessionId);
        const currentSession = response.data;
        
        // Check if session was ended by the other user
        if (currentSession.status === 'completed' && !callEndedByMe) {
          console.log('🛑 Call ended by other user - terminating immediately');
          setCallEndedByOther(true);
          
          // Show immediate notification
          toast('📞 Call ended by the other user', { 
            icon: '👋',
            duration: 3000,
            style: {
              background: '#f3f4f6',
              color: '#374151',
            }
          });
          
          // End the call immediately with special handling
          handleRemoteCallEnd();
          return;
        }
        
        // Update session data
        setSessionData(currentSession);
        
      } catch (error: any) {
        console.error('Error monitoring session:', error);
        // If session not found, it might have been ended
        if (error.response?.status === 404 && !callEndedByMe) {
          console.log('🛑 Session not found - call likely ended by other user');
          setCallEndedByOther(true);
          handleRemoteCallEnd();
        }
      }
    }, 2000); // Check every 2 seconds for immediate feedback
  };

  const handleRemoteCallEnd = async () => {
    console.log('🛑 Handling remote call termination...');
    
    // Clear monitoring
    if (sessionMonitorRef.current) {
      clearInterval(sessionMonitorRef.current);
      sessionMonitorRef.current = null;
    }
    
    // Cleanup WebRTC connections
    cleanup();
    
    // Navigate with specific message for remote termination
    setTimeout(() => {
      if (sessionData?.match_id) {
        navigate(`/swipe/${sessionData.match_id}`);
      } else {
        navigate('/dashboard');
      }
    }, 2000); // Give user time to see the message
  };

  const setupWebRTC = async () => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('HTTPS_REQUIRED: Camera access requires HTTPS when accessing from network IPs. Please use HTTPS or localhost.');
      }

      console.log('🎥 Requesting camera and microphone access...');
      toast.loading('Requesting camera and microphone access...', { id: 'media-access' });

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      toast.success('Camera and microphone access granted!', { id: 'media-access' });
      console.log('✅ Media access granted successfully');
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      };

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Add local stream to peer connection
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        setConnectionStatus('connected');
        setIsConnected(true);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate && sessionId) {
          try {
            await videoAPI.sendSignal({
              type: 'ice-candidate',
              data: event.candidate.toJSON(),
              target_user_id: 0, // Will be set by backend
              session_id: sessionId,
            });
          } catch (error) {
            console.error('Failed to send ICE candidate:', error);
          }
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (state === 'connected') {
          setConnectionStatus('connected');
          setIsConnected(true);
        } else if (state === 'disconnected' || state === 'failed') {
          setConnectionStatus('disconnected');
          setIsConnected(false);
        }
      };

    } catch (error) {
      console.error('Failed to setup WebRTC:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('getUserMedia not supported') || errorMessage.includes('insecure context')) {
        toast.error('Camera access requires HTTPS when accessing from network. Please use localhost or enable HTTPS.', {
          duration: 6000,
        });
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        toast.error('Please allow camera and microphone access to start video call.');
      } else {
        toast.error('Failed to access camera or microphone');
      }
    }
  };

  const startSignaling = () => {
    // Clear any existing interval
    if (signalingIntervalRef.current) {
      console.log('🔄 Clearing existing signaling interval');
      clearInterval(signalingIntervalRef.current);
    }

    console.log('🎯 Starting signaling for session:', sessionId);
    
    let pollCount = 0;
    const maxPolls = 30; // Stop after 60 seconds (30 * 2s intervals)

    // Poll for WebRTC signals
    const pollSignals = async () => {
      pollCount++;
      console.log(`📡 Polling signals #${pollCount} for session: ${sessionId}`);
      
      if (!sessionId || !isCallStarted) {
        console.log('⚠️ Stopping polling - no session or call not started');
        return;
      }
      
      // Stop after max attempts
      if (pollCount > maxPolls) {
        console.log('⏰ Stopping polling - max attempts reached');
        if (signalingIntervalRef.current) {
          clearInterval(signalingIntervalRef.current);
          signalingIntervalRef.current = null;
        }
        return;
      }
      
      // Stop polling if connected and stable
      if (isConnected && peerConnectionRef.current?.connectionState === 'connected') {
        console.log('✅ Stopping polling - connection established');
        if (signalingIntervalRef.current) {
          clearInterval(signalingIntervalRef.current);
          signalingIntervalRef.current = null;
        }
        return;
      }
      
      try {
        const response = await videoAPI.getSignals(sessionId);
        const signals = response.data.signals;
        
        if (signals.length > 0) {
          console.log(`📨 Received ${signals.length} signals`);
        }
        
        for (const signal of signals) {
          await handleSignal(signal);
        }
      } catch (error: any) {
        console.error('❌ Failed to get signals:', error);
        
        // Stop polling if rate limited (429) or unauthorized (401)
        if (error.response?.status === 429 || error.response?.status === 401) {
          console.log('🛑 Stopping polling due to rate limit or unauthorized access');
          if (signalingIntervalRef.current) {
            clearInterval(signalingIntervalRef.current);
            signalingIntervalRef.current = null;
          }
          return;
        }
        
        // For other errors, add a delay to prevent spam
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    };

    // Start polling every 2 seconds (reduced frequency)
    console.log('🔄 Setting up signaling interval (2s)');
    signalingIntervalRef.current = setInterval(pollSignals, 2000);
    
    // Create offer if we're the initiator
    setTimeout(createOffer, 2000);
  };

  const createOffer = async () => {
    if (!peerConnectionRef.current || !sessionId) return;

    try {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      await videoAPI.sendSignal({
        type: 'offer',
        data: offer,
        target_user_id: 0, // Will be set by backend
        session_id: sessionId,
      });
    } catch (error) {
      console.error('Failed to create offer:', error);
    }
  };

  const handleSignal = async (signal: any) => {
    if (!peerConnectionRef.current) return;

    try {
      switch (signal.type) {
        case 'offer':
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          
          if (sessionId) {
            await videoAPI.sendSignal({
              type: 'answer',
              data: answer,
              target_user_id: signal.from_user_id,
              session_id: sessionId,
            });
          }
          break;
          
        case 'answer':
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
          break;
          
        case 'ice-candidate':
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.data));
          break;
          
        default:
          console.warn('Unknown signal type:', signal.type);
      }
    } catch (error) {
      console.error('Failed to handle signal:', error);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerOff;
      setIsSpeakerOff(!isSpeakerOff);
    }
  };

  const endCall = async (isTimerExpired = false) => {
    console.log('🛑 Call ending...', { isTimerExpired, isContinuousMatching });
    setCallEndedByMe(true); // Mark that this user ended the call
    
    // Clear session monitoring immediately
    if (sessionMonitorRef.current) {
      clearInterval(sessionMonitorRef.current);
      sessionMonitorRef.current = null;
    }
    
    try {
      if (sessionId) {
        await videoAPI.endCall(sessionId);
        console.log('✅ Call ended successfully on backend');
      }
      
      cleanup();
      
      // Handle continuous matching flow
      if (isContinuousMatching && isTimerExpired && matchId && continuousSessionId) {
        console.log('🔄 Timer expired in continuous matching - showing decision popup');
        
        // Load match data for the popup
        try {
          const matches = await matchingAPI.getMatches();
          const currentMatch = matches.data.find((m: any) => m.id === parseInt(matchId));
          
          if (currentMatch) {
            setMatchData({
              match_id: currentMatch.id,
              user_name: currentMatch.matched_user_name,
              user_age: currentMatch.matched_user_age,
              user_bio: currentMatch.matched_user_bio,
              user_interests: currentMatch.matched_user_interests,
              compatibility_score: currentMatch.compatibility_score
            });
            setShowDecisionPopup(true);
            return; // Don't navigate away, show popup instead
          }
        } catch (error) {
          console.error('Failed to load match data:', error);
        }
      }
      
      // Regular flow or fallback
      if (sessionData?.match_id && !isContinuousMatching) {
        navigate(`/swipe/${sessionData.match_id}`);
      } else if (isContinuousMatching) {
        navigate('/continuous-matching');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Failed to end call:', error);
      cleanup();
      navigate('/dashboard');
    }
  };

  const cleanup = () => {
    console.log('🧹 VideoCall cleanup starting...');
    
    // Clear signaling interval
    if (signalingIntervalRef.current) {
      console.log('🔄 Clearing signaling interval');
      clearInterval(signalingIntervalRef.current);
      signalingIntervalRef.current = null;
    }
    
    // Clear session monitoring interval
    if (sessionMonitorRef.current) {
      console.log('🔍 Clearing session monitoring interval');
      clearInterval(sessionMonitorRef.current);
      sessionMonitorRef.current = null;
    }
    
    // Stop local stream
    if (localStreamRef.current) {
      console.log('📹 Stopping local stream tracks');
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      console.log('🔌 Closing peer connection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    console.log('✅ VideoCall cleanup complete');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Continuous matching handlers
  const handleContinueWithMatch = () => {
    console.log('💕 User chose to continue with match');
    setShowDecisionPopup(false);
    
    // Navigate back to continuous matching interface with success
    navigate('/continuous-matching?action=continued');
  };

  const handleGetNextMatch = () => {
    console.log('🔄 User chose to get next match');
    setShowDecisionPopup(false);
    
    // Navigate back to continuous matching interface to find next match
    navigate('/continuous-matching?action=next');
  };

  const handleCloseDecisionPopup = () => {
    setShowDecisionPopup(false);
    
    // Default navigation
    if (isContinuousMatching) {
      navigate('/continuous-matching');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Video Container */}
      <div className="relative w-full h-full">
        {/* Remote Video (Main) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted={isSpeakerOff}
          className="w-full h-full object-cover"
        />
        
        {/* Remote Video Placeholder */}
        {!isConnected && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center text-white">
              <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <VideoCameraIcon className="h-16 w-16 text-gray-400" />
              </div>
              <p className="text-lg font-medium">
                {!isCallStarted 
                  ? 'Waiting for other user to join call...'
                  : connectionStatus === 'connecting' 
                    ? 'Connecting...' 
                    : 'Waiting for your match to join'
                }
              </p>
              {!isCallStarted && (
                <p className="text-sm text-gray-300 mt-2">
                  Timer will start when both users are connected
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden border-2 border-white shadow-lg">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <VideoCameraSlashIcon className="h-8 w-8 text-gray-400" />
            </div>
          )}
        </div>
        
        {/* Timer - Only show when call has actually started */}
        {isCallStarted && (
          <div className="absolute top-4 left-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`px-4 py-2 rounded-full font-bold text-lg ${
                timeLeft <= 10 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-black/50 text-white backdrop-blur-sm'
              }`}
            >
              {formatTime(timeLeft)}
            </motion.div>
          </div>
        )}
        
        {/* Waiting Status - Show when waiting for other user */}
        {!isCallStarted && (
          <div className="absolute top-4 left-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="px-4 py-2 rounded-full font-bold text-lg bg-yellow-500/90 text-black backdrop-blur-sm"
            >
              ⏳ Waiting...
            </motion.div>
          </div>
        )}
        
        {/* Connection Status */}
        <AnimatePresence>
          {connectionStatus === 'connecting' && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="absolute top-20 left-1/2 transform -translate-x-1/2"
            >
              <div className="bg-yellow-500 text-black px-4 py-2 rounded-full font-medium flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                Connecting...
              </div>
            </motion.div>
          )}
          
          {connectionStatus === 'connected' && isConnected && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className="absolute top-20 left-1/2 transform -translate-x-1/2"
            >
              <div className="bg-green-500 text-white px-4 py-2 rounded-full font-medium">
                ✓ Connected
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Controls */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center space-x-4 bg-black/50 backdrop-blur-sm rounded-full px-6 py-4">
            <button
              onClick={toggleMute}
              className={`p-3 rounded-full transition-all duration-200 ${
                isMuted 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isMuted ? (
                <MicrophoneIcon className="h-6 w-6 text-white opacity-50" />
              ) : (
                <MicrophoneIcon className="h-6 w-6 text-white" />
              )}
            </button>
            
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition-all duration-200 ${
                isVideoOff 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isVideoOff ? (
                <VideoCameraSlashIcon className="h-6 w-6 text-white" />
              ) : (
                <VideoCameraIcon className="h-6 w-6 text-white" />
              )}
            </button>
            
            <button
              onClick={toggleSpeaker}
              className={`p-3 rounded-full transition-all duration-200 ${
                isSpeakerOff 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {isSpeakerOff ? (
                <SpeakerXMarkIcon className="h-6 w-6 text-white" />
              ) : (
                <SpeakerWaveIcon className="h-6 w-6 text-white" />
              )}
            </button>
            
            <button
              onClick={() => endCall(false)}
              className="p-3 bg-red-500 hover:bg-red-600 rounded-full transition-all duration-200"
            >
              <PhoneXMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>
        
        {/* Call Info */}
        <div className="absolute bottom-8 left-4">
          <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
            <p className="font-medium">Video Date Session</p>
            <p className="text-white/80">
              {isConnected ? 'Call in progress' : 'Waiting for connection'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Call End Overlay - Time's Up */}
      <AnimatePresence>
        {timeLeft === 0 && !callEndedByOther && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center"
          >
            <div className="text-center text-white">
              <h2 className="text-3xl font-bold mb-4">Time's Up!</h2>
              <p className="text-lg mb-6">Your 1-minute video date has ended.</p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              <p className="mt-2 text-sm text-white/80">Redirecting to decision page...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call End Overlay - Ended by Other User */}
      <AnimatePresence>
        {callEndedByOther && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center"
          >
            <div className="text-center text-white">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mb-6"
              >
                <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">👋</span>
                </div>
              </motion.div>
              <h2 className="text-3xl font-bold mb-4">Call Ended</h2>
              <p className="text-lg mb-6">The other user ended the call.</p>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              <p className="mt-2 text-sm text-white/80">Redirecting to decision page...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-Call Decision Popup for Continuous Matching */}
      {showDecisionPopup && matchData && continuousSessionId && (
        <PostCallDecisionPopup
          isOpen={showDecisionPopup}
          matchData={matchData}
          sessionId={continuousSessionId}
          onContinue={handleContinueWithMatch}
          onNext={handleGetNextMatch}
          onClose={handleCloseDecisionPopup}
        />
      )}
    </div>
  );
};

export default VideoCall;
