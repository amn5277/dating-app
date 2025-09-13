# Continuous Matching System - Technical Guide

## Overview
The continuous matching system enables real-time, instant video date connections between users without traditional "swipe and wait" mechanics. Users enter a matching pool and are automatically connected to compatible users for immediate video calls.

---

## Backend Architecture

### Core Components

#### 1. Database Models
```python
# Primary Models
MatchingSession    # Active matching sessions for users
InstantCallSession # Non-match video calls for continuous matching  
VideoSession      # Video call sessions with WebRTC data
Match             # Traditional matches (used for ratings/decisions)
User              # User profiles and data
PersonalityRating # Post-call personality ratings

# Junction Tables  
video_participants # Links users to video sessions
```

#### 2. Key Database Fields

**MatchingSession**
```python
session_id: str          # UUID for frontend reference
user_id: int            # User in matching pool
status: str             # "active", "paused", "ended"  
last_active: datetime   # For timeout/cleanup
matched_user_ids: str   # Comma-separated exclusion list
min_age, max_age: int   # Filtering criteria
preferred_interests: list
personality_weight: float
```

**InstantCallSession** 
```python
session_id: str         # Video session UUID
user1_id, user2_id: int # Paired users (deterministic ordering)
status: str             # "waiting", "active", "completed", "cancelled"
call_completed: bool    # Call finished successfully
created_at: datetime    # For deadlock prevention
```

**VideoSession**
```python
session_id: str         # UUID matching InstantCallSession
match_id: int          # NULL for continuous matching
duration: int          # 180 seconds (3 minutes) 
status: str            # "waiting", "active", "completed"
started_at: datetime   # When both users joined
```

---

## API Endpoints & Backend Logic

### 1. Start Matching Session
**`POST /api/continuous-matching/start`**

**Frontend Call:**
```javascript
const response = await continuousMatchingAPI.startSession({
  min_age: 18,
  max_age: 35, 
  preferred_interests: ["Gaming", "Movies"],
  personality_weight: 0.5
});
```

**Backend Logic:**
```python
def start_matching_session():
  # 1. Validate user authentication
  # 2. End any existing matching sessions for user
  # 3. Create new MatchingSession with status="active"
  # 4. Set last_active = now()
  # 5. Initialize empty matched_user_ids exclusion list
  # 6. Return session_id for frontend polling
```

**Response:**
```json
{
  "session_id": "uuid-string",
  "status": "active",
  "message": "Started matching session"
}
```

---

### 2. Find Next Match (Core Matching Logic)
**`GET /api/continuous-matching/next-match?session_id=<uuid>`**

**Frontend Call:**
```javascript
// Continuous polling every 2-3 seconds
const response = await continuousMatchingAPI.getNextMatch(sessionId);
```

**Backend Logic:**
```python
def get_next_match(session_id):
  # 1. AUTHENTICATION & SESSION VALIDATION
  matching_session = get_user_matching_session(current_user, session_id)
  if not matching_session or matching_session.status != "active":
    return {"match_found": False, "message": "Not actively matching"}
  
  # 2. UPDATE LAST_ACTIVE (Heartbeat)
  matching_session.last_active = datetime.now(timezone.utc)
  
  # 3. CHECK FOR INCOMING INSTANT CALLS 
  # Look for InstantCallSessions where user is user2_id and status="waiting"
  incoming_call = check_incoming_instant_calls(current_user.id)
  if incoming_call:
    return auto_connect_to_incoming_call(incoming_call)
  
  # 4. FIND NEW MATCH CANDIDATE
  matched_user = find_next_active_match(db, matching_session)
  if not matched_user:
    return {"match_found": False, "message": "No active users found"}
  
  # 5. CREATE INSTANT CALL SESSION
  call_session = create_continuous_call_session(matching_session, matched_user)
  
  # 6. RETURN MATCH DATA FOR AUTO-CONNECTION
  return {
    "match_found": True,
    "match_data": {
      "call_session_id": call_session.id,
      "video_session_id": call_session.session_id,
      "user_name": matched_user.name,
      "user_age": matched_user.age,
      "user_bio": matched_user.bio,
      "user_interests": matched_user.interests,
      "compatibility_score": calculate_compatibility(),
      "is_actual_match": False  # Not a Match record yet
    }
  }
```

**Ultra-Fast Matching Algorithm:**
```python
def find_next_active_match(db, matching_session):
  now = datetime.now(timezone.utc)
  
  # ULTRA-STRICT: Only users active within 15 seconds
  active_cutoff = now - timedelta(seconds=15)
  
  # Get exclusion list (users already matched/skipped)
  matched_ids = []
  if matching_session.matched_user_ids:
    matched_ids = [int(id) for id in matching_session.matched_user_ids.split(',')]
  
  # Query for active matchers (excluding already matched users)
  candidate = db.query(User).join(MatchingSession).filter(
    and_(
      User.id != matching_session.user_id,      # Not self
      User.id.notin_(matched_ids),              # Not in exclusion list
      MatchingSession.status == "active",       # Actively matching
      MatchingSession.last_active >= active_cutoff,  # Active within 15s
      User.age.between(matching_session.min_age, matching_session.max_age)
    )
  ).order_by(MatchingSession.last_active.desc()).first()
  
  return candidate
```

---

### 3. Video Session Management 
**`GET /api/video/session/<session_id>`**

**Frontend Call:**
```javascript
// Called when VideoCall component loads
const sessionData = await videoAPI.getSession(sessionId);
```

**Backend Logic:**
```python
def get_video_session(session_id):
  # 1. Find VideoSession by session_id
  session = db.query(VideoSession).filter(VideoSession.session_id == session_id).first()
  
  # 2. AUTHORIZATION CHECK
  if session.match_id:
    # Regular match - check Match authorization
    match = db.query(Match).filter(Match.id == session.match_id).first()
    authorize_match_user(current_user, match)
  else:
    # Instant call session - check InstantCallSession authorization
    call_session = db.query(InstantCallSession).filter(InstantCallSession.session_id == session_id).first()
    authorize_instant_call_user(current_user, call_session)
    
    # 3. VALIDATE BOTH USERS STILL ACTIVELY MATCHING
    # Prevent 410 Gone errors by checking 30-minute window (not 10 minutes)
    active_cutoff = now - timedelta(minutes=30)  # LENIENT for video calls
    
    user1_active = check_user_active_matching(call_session.user1_id, active_cutoff)
    user2_active = check_user_active_matching(call_session.user2_id, active_cutoff) 
    
    if not user1_active or not user2_active:
      # Cancel session and return HTTP 410
      session.status = "cancelled"
      call_session.status = "cancelled"
      raise HTTPException(status_code=410, detail="Call cancelled - other user is no longer actively matching")
    
    # 4. PROACTIVE UPDATE: Refresh both users' last_active timestamps
    update_matching_session_timestamps(user1_active, user2_active)
  
  return session  # 200 OK with session data
```

---

### 4. Join Video Call
**`POST /api/video/join-call/<session_id>`**

**Frontend Call:**
```javascript
// Called after VideoCall component initializes WebRTC
const joinResponse = await videoAPI.joinCall(sessionId);
```

**Backend Logic:**
```python
def join_video_call(session_id):
  # 1. Find video session and authorize user
  # 2. Mark user as "joined" in video_participants table
  # 3. Check if BOTH users have now joined
  
  participants = get_session_participants(session_id)
  both_joined = len(participants) == 2 and all(p.joined_at for p in participants)
  
  if both_joined and session.status == "waiting":
    # 4. START THE TIMER - Both users connected!
    session.status = "active" 
    session.started_at = datetime.now(timezone.utc)
    
    # 5. Schedule auto-end after duration (3 minutes)
    schedule_auto_end_session(session_id, session.duration)
    
    return {"timer_started": True, "message": "Both users joined - timer started"}
  else:
    return {"timer_started": False, "message": "Waiting for other user"}
```

---

### 5. WebRTC Signaling
**`GET /api/video/signals/<session_id>`** (Polling)
**`POST /api/video/send-signal`** (Send offer/answer/ICE)

**Frontend Calls:**
```javascript
// Continuous polling for WebRTC signals
const signals = await videoAPI.getSignals(sessionId);

// Send WebRTC offer/answer/ICE candidates  
await videoAPI.sendSignal({
  session_id: sessionId,
  type: "offer", // or "answer", "ice-candidate"
  data: rtcSessionDescription,
  target_user_id: 0 // Auto-determined by backend
});
```

**Backend Logic:**
```python
# In-memory storage for real-time signaling
webrtc_signals = {}  # {session_id: [signals]}

def get_signals(session_id):
  # 1. Authorize user for session
  # 2. Filter signals intended for current_user
  user_signals = [s for s in webrtc_signals.get(session_id, []) 
                  if s.target_user_id == current_user.id]
  # 3. Remove retrieved signals to prevent duplicates
  webrtc_signals[session_id] = [s for s in webrtc_signals.get(session_id, [])
                                if s.target_user_id != current_user.id]
  return {"signals": user_signals}

def send_signal(signal_data):
  # 1. Authorize user for session
  # 2. Determine target_user_id (the OTHER user in the session)
  # 3. Store signal in webrtc_signals for target user to poll
  # 4. Return success confirmation
```

---

### 6. Session Monitoring & Auto-End
**`GET /api/video/session/<session_id>`** (Continuous polling for status)

**Frontend Call:**
```javascript
// Every 2 seconds - monitor for remote user ending call
const sessionData = await videoAPI.getSession(sessionId);
if (sessionData.status === 'completed') {
  // Other user ended call - show popup or redirect
}
```

**Backend Auto-End Logic:**
```python
async def auto_end_session(session_id: str):
  # Called via background task after session.duration seconds
  await asyncio.sleep(session.duration)  # 180 seconds (3 minutes)
  
  session = db.query(VideoSession).filter(VideoSession.session_id == session_id).first()
  if session and session.status == "active":
    session.status = "completed"
    session.ended_at = datetime.now(timezone.utc)
    
    # Update InstantCallSession if applicable
    if not session.match_id:
      call_session = db.query(InstantCallSession).filter(InstantCallSession.session_id == session_id).first()
      if call_session:
        call_session.status = "completed"
        call_session.call_completed = True
    
    db.commit()
    print(f"⏰ Auto-ended video session {session_id} after {session.duration} seconds")
```

---

### 7. End Call & Continue Decision
**`POST /api/video/end-call/<session_id>`** (Manual end)
**`POST /api/continuous-matching/continue-decision`** (Post-call decision)

**Frontend Calls:**
```javascript
// User clicks "End Call" button
await videoAPI.endCall(sessionId);

// User decides to skip/continue after call ends  
await continuousMatchingAPI.handleDecision({
  session_id: continuousSessionId,
  match_id: callSessionId,
  decision: "skip"  // or "continue", "next"
});
```

**Backend Logic:**
```python
def handle_continue_decision(request):
  # 1. Find Match OR InstantCallSession by request.match_id
  match = db.query(Match).filter(Match.id == request.match_id).first()
  if not match:
    # Try InstantCallSession
    call_session = db.query(InstantCallSession).filter(InstantCallSession.id == request.match_id).first()
  
  # 2. Determine OTHER user to exclude (if decision is "skip")
  if match:
    other_user_id = match.matched_user_id if match.user_id == current_user.id else match.user_id
  else:
    other_user_id = call_session.user2_id if call_session.user1_id == current_user.id else call_session.user1_id
  
  # 3. Process decision
  if request.decision == "skip":
    # Add other_user_id to matching_session.matched_user_ids exclusion list
    matching_session = get_user_matching_session(current_user, request.session_id)
    if matching_session.matched_user_ids:
      matched_ids = matching_session.matched_user_ids + f",{other_user_id}"
    else:
      matched_ids = str(other_user_id)
    matching_session.matched_user_ids = matched_ids
    
    # Mark session/match as "passed"
    if match:
      match.status = "passed" 
    else:
      call_session.status = "passed"
  
  elif request.decision == "continue":
    # Create actual Match record for potential relationship
    create_mutual_match(current_user.id, other_user_id)
  
  db.commit()
  return {"message": f"Decision '{request.decision}' processed"}
```

---

## Frontend User Journey

### Phase 1: Enter Matching Pool
```javascript
// 1. User clicks "Start Matching" 
const handleStartMatching = async () => {
  // Create matching session on backend
  const response = await continuousMatchingAPI.startSession(preferences);
  
  // Store session ID and start polling
  setMatchingSession(response.session_id);
  setIsMatching(true);
  
  // Begin continuous polling for matches
  startMatchingLoop();
};
```

### Phase 2: Continuous Match Polling
```javascript
// 2. Frontend polls for matches every 2-3 seconds
const getNextMatch = async () => {
  const response = await continuousMatchingAPI.getNextMatch(sessionId);
  
  if (response.match_found) {
    // Auto-connect to video call
    const { video_session_id, call_session_id, user_name } = response.match_data;
    
    toast.success(`Found your next match! Connecting to ${user_name}...`);
    
    // Navigate to VideoCall component
    navigate(`/video-call/${video_session_id}?continuous=true&session_id=${sessionId}&match_id=${call_session_id}`);
  } else {
    // No match yet - continue polling
    setTimeout(getNextMatch, 2000);
  }
};
```

### Phase 3: Video Call Initialization
```javascript
// 3. VideoCall component loads and initializes
const initializeCall = async () => {
  // Get video session data from backend
  const sessionData = await videoAPI.getSession(videoSessionId);
  
  // Setup WebRTC peer connection
  await setupWebRTC();
  
  // Start WebRTC signaling polling
  startSignaling(); 
  
  // Join the call (marks user as "joined")
  const joinResponse = await videoAPI.joinCall(videoSessionId);
  
  if (joinResponse.timer_started) {
    // Both users joined - start 3 minute timer
    setIsCallStarted(true);
    setTimeLeft(180); // 3 minutes
    
    // Monitor for remote user ending call
    startSessionMonitoring();
  } else {
    // Wait for other user to join
    pollForOtherUser();
  }
};
```

### Phase 4: WebRTC Connection Establishment
```javascript
// 4. WebRTC signaling loop
const pollSignals = async () => {
  const response = await videoAPI.getSignals(sessionId);
  
  for (const signal of response.signals) {
    await handleSignal(signal); // Process offer/answer/ICE
  }
  
  setTimeout(pollSignals, 2000); // Continue polling
};

// Handle WebRTC signals (offer/answer/ICE candidates)
const handleSignal = async (signal) => {
  switch (signal.type) {
    case 'offer':
      await peerConnection.setRemoteDescription(signal.data);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await videoAPI.sendSignal({ type: 'answer', data: answer, session_id: sessionId });
      break;
      
    case 'answer':
      await peerConnection.setRemoteDescription(signal.data);
      break;
      
    case 'ice-candidate':
      await peerConnection.addIceCandidate(signal.data);
      break;
  }
};
```

### Phase 5: Call End & Decision
```javascript
// 5. Call ends (timer expires or user clicks end)
const endCall = async () => {
  // Stop all polling and WebRTC
  cleanup();
  
  // Notify backend
  await videoAPI.endCall(sessionId);
  
  if (isContinuousMatching && timerExpired) {
    // Show personality rating popup
    setShowDecisionPopup(true);
  } else {
    // Return to dashboard or continuous matching
    navigate('/continuous-matching');
  }
};

// 6. User makes decision (continue/skip/next)
const handleDecision = async (decision) => {
  await continuousMatchingAPI.handleDecision({
    session_id: continuousSessionId,
    match_id: callSessionId, 
    decision: decision
  });
  
  if (decision === 'skip') {
    // Navigate back to continuous matching with exclusion
    navigate(`/continuous-matching?session_id=${continuousSessionId}&action=skip&skipped_match=${callSessionId}`);
  }
};
```

### Phase 6: Return to Matching Pool
```javascript
// 7. Process URL parameters and resume matching
useEffect(() => {
  const params = new URLSearchParams(location.search);
  const action = params.get('action');
  const sessionId = params.get('session_id');
  const skippedMatch = params.get('skipped_match');
  
  if (action === 'skip' && sessionId && skippedMatch) {
    // Restore matching session state
    setMatchingSession(sessionId);
    setIsMatching(true);
    
    // Send skip decision to backend (if not already sent)
    continuousMatchingAPI.handleDecision({
      session_id: sessionId,
      match_id: parseInt(skippedMatch),
      decision: 'skip'
    });
    
    // Resume matching loop (excluded user will not appear again)
    startMatchingLoop();
  }
}, []);
```

---

## State Management & Cleanup

### Backend Cleanup (every 30 seconds)
```python
def cleanup_stale_sessions():
  now = datetime.now(timezone.utc)
  
  # 1. End stale matching sessions (30 seconds timeout)
  stale_cutoff = now - timedelta(seconds=30)
  stale_sessions = db.query(MatchingSession).filter(
    and_(
      MatchingSession.status == "active",
      MatchingSession.last_active < stale_cutoff
    )
  ).all()
  
  for session in stale_sessions:
    session.status = "ended"
    print(f"🧹 Cleaned up stale matching session: {session.session_id}")
  
  # 2. Cancel abandoned video sessions
  abandoned_sessions = db.query(VideoSession).filter(
    and_(
      VideoSession.status == "waiting",
      VideoSession.created_at < now - timedelta(minutes=5)
    )
  ).all()
  
  for session in abandoned_sessions:
    session.status = "cancelled"
    print(f"🧹 Cancelled abandoned video session: {session.session_id}")
  
  db.commit()
```

### Frontend Cleanup
```javascript
// Heartbeat to keep matching session alive
useEffect(() => {
  if (!isMatching || !matchingSession) return;
  
  const heartbeat = setInterval(async () => {
    try {
      await continuousMatchingAPI.heartbeat(matchingSession);
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }, 8000); // Every 8 seconds
  
  return () => clearInterval(heartbeat);
}, [isMatching, matchingSession]);

// Cleanup on component unmount/page unload
useEffect(() => {
  const cleanup = () => {
    if (matchingSession) {
      continuousMatchingAPI.endSession(matchingSession);
    }
  };
  
  window.addEventListener('beforeunload', cleanup);
  return () => {
    cleanup();
    window.removeEventListener('beforeunload', cleanup);
  };
}, [matchingSession]);
```

---

## Key Engineering Principles

### 1. **Deadlock Prevention**
- Deterministic pairing using `min(user1_id, user2_id)` ordering
- Check for existing sessions before creating new ones
- 10-minute recent session window prevents duplicate calls

### 2. **Race Condition Mitigation** 
- Frontend API call protection with `apiCallInProgress` flags
- Backend proactive timestamp updates on session access
- Ultra-strict 15-second active user filtering

### 3. **Session State Consistency**
- Matching sessions tracked separately from video sessions
- InstantCallSession vs Match distinction for different flows
- Exclusion lists prevent re-matching skipped users

### 4. **Real-time Performance**
- In-memory WebRTC signaling storage
- 2-3 second polling intervals for responsiveness  
- Background cleanup tasks prevent database bloat

### 5. **Fault Tolerance**
- HTTP 410 errors for graceful session expiration
- Automatic session cleanup and recovery
- Heartbeat mechanisms to detect inactive users

### 6. **Scalability Considerations**
- Indexed database queries on `last_active` and `status` fields
- Pagination support for large user pools
- Background task scheduling for cleanup operations

---

## Debugging & Monitoring

### Key Metrics to Monitor
- Active matching sessions count
- Video session success rate (waiting → active → completed)
- WebRTC connection establishment time
- Average time between match requests
- User exclusion list sizes

### Common Issues & Solutions
- **HTTP 410 errors**: Check matching session timeouts
- **WebRTC connection failures**: Verify signaling polling and STUN servers
- **Duplicate matches**: Verify exclusion list updates in continue-decision
- **Session leaks**: Monitor cleanup task execution
- **Frontend state inconsistency**: Check React closure issues and useRef usage

### Debug Logging Examples
```python
print(f"🎯 SELECTED MATCH: User {matched_user.id} ({matched_user.name})")
print(f"⏰ Last active: {matched_user.matching_session.last_active}")  
print(f"🎯 Creating call session between users {user1_id} and {user2_id}")
print(f"🔍 EXCLUSION LIST: {matching_session.matched_user_ids}")
```

---

This architecture provides real-time, scalable continuous matching with robust error handling and state management for seamless user experience.
