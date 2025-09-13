from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from pydantic import BaseModel
import asyncio

from database import get_db, User, Match, VideoSession, InstantCallSession, MatchingSession, video_participants
from routers.auth import get_current_user

router = APIRouter()

# Pydantic models
class VideoSessionResponse(BaseModel):
    id: int
    session_id: str
    match_id: Optional[int]  # Can be None for instant call sessions in continuous matching
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration: int
    status: str

    class Config:
        from_attributes = True

class StartCallRequest(BaseModel):
    match_id: int

class WebRTCSignal(BaseModel):
    type: str  # "offer", "answer", "ice-candidate"
    data: dict
    target_user_id: int
    session_id: str

# In-memory storage for WebRTC signaling (in production, use Redis)
webrtc_signals = {}  # session_id -> list of signals

# Track connected users per session for timer management
connected_users = {}  # session_id -> set of user_ids

# Rate limiting for signals endpoint
signal_request_counts = {}  # user_id -> {'count': int, 'last_reset': datetime}

# Helper functions
def get_match_by_id(db: Session, match_id: int) -> Optional[Match]:
    return db.query(Match).filter(Match.id == match_id).first()

def create_video_session(db: Session, match: Match) -> VideoSession:
    """Create a new video session for a match"""
    video_session = VideoSession(
        session_id=match.video_session_id,
        match_id=match.id,
        duration=180,  # 3 minutes - more time for WebRTC connection
        status="waiting"
    )
    
    db.add(video_session)
    db.flush()
    
    # Add participants
    db.execute(
        video_participants.insert().values([
            {"video_session_id": video_session.id, "user_id": match.user_id},
            {"video_session_id": video_session.id, "user_id": match.matched_user_id}
        ])
    )
    
    db.commit()
    db.refresh(video_session)
    return video_session

def start_video_session(db: Session, session_id: str) -> Optional[VideoSession]:
    """Start a video session"""
    session = db.query(VideoSession).filter(VideoSession.session_id == session_id).first()
    if session and session.status == "waiting":
        session.status = "active"
        session.started_at = datetime.utcnow()
        db.commit()
        return session
    return None

def end_video_session(db: Session, session_id: str) -> Optional[VideoSession]:
    """End a video session and mark the match as call completed"""
    session = db.query(VideoSession).filter(VideoSession.session_id == session_id).first()
    if session and session.status == "active":
        session.status = "completed"
        session.ended_at = datetime.utcnow()
        
        # Mark match as call completed
        match = db.query(Match).filter(Match.id == session.match_id).first()
        if match:
            match.call_completed = True
        
        # Clear connected users tracking for this session
        if session_id in connected_users:
            print(f"🧹 Cleaning up connected users for session {session_id}")
            del connected_users[session_id]
        
        # Clear WebRTC signals for this session
        if session_id in webrtc_signals:
            print(f"🧹 Cleaning up WebRTC signals for session {session_id}")
            del webrtc_signals[session_id]
        
        # Clean up old completed sessions for this match (keep only last 3)
        try:
            old_sessions = db.query(VideoSession).filter(
                and_(
                    VideoSession.match_id == session.match_id,
                    VideoSession.status == "completed"
                )
            ).order_by(VideoSession.created_at.desc()).offset(3).all()
            
            if old_sessions:
                print(f"🗑️ Auto-cleaning up {len(old_sessions)} old sessions for match {session.match_id}")
                for old_session in old_sessions:
                    db.delete(old_session)
                
        except Exception as e:
            print(f"⚠️ Error during session cleanup: {e}")
        
        db.commit()
        return session
    return None

async def auto_end_session(session_id: str):
    """Automatically end session after 1 minute"""
    await asyncio.sleep(60)  # Wait 1 minute
    
    # Create a new database session for this background task
    from database import SessionLocal
    db = SessionLocal()
    try:
        end_video_session(db, session_id)
        print(f"🕒 Auto-ended session {session_id} after 1 minute")
    except Exception as e:
        print(f"❌ Error auto-ending session {session_id}: {e}")
        db.rollback()
    finally:
        db.close()  # Critical: Always close the session

# Routes
@router.post("/start-call", response_model=VideoSessionResponse)
async def start_video_call(
    start_call: StartCallRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a video call for a match"""
    match = get_match_by_id(db, start_call.match_id)
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Check if user is part of this match
    if current_user.id not in [match.user_id, match.matched_user_id]:
        raise HTTPException(status_code=403, detail="Not authorized for this match")
    
    # Check if there's an active video session
    active_session = db.query(VideoSession).filter(
        and_(
            VideoSession.match_id == match.id,
            VideoSession.status == "active"
        )
    ).first()
    
    if active_session:
        raise HTTPException(status_code=400, detail="Call already in progress")
    
    # For mutual matches, allow multiple calls but prevent duplicates
    if match.status == "matched":
        print(f"💕 Mutual match detected! Checking for existing active sessions for match {match.id}")
        
        # Check if there's already a waiting or active session
        existing_session = db.query(VideoSession).filter(
            and_(
                VideoSession.match_id == match.id,
                VideoSession.status.in_(["waiting", "active"])
            )
        ).order_by(VideoSession.created_at.desc()).first()
        
        if existing_session:
            print(f"♻️ Reusing existing session {existing_session.session_id} for mutual match")
            session = existing_session
        else:
            print(f"🆕 Creating new session for mutual match {match.id}")
            # Clean up old completed sessions to prevent clutter
            old_sessions = db.query(VideoSession).filter(
                and_(
                    VideoSession.match_id == match.id,
                    VideoSession.status == "completed"
                )
            ).all()
            
            for old_session in old_sessions:
                print(f"🗑️ Cleaning up old completed session {old_session.session_id}")
                db.delete(old_session)
            
            # Generate new session ID for the new call
            import uuid
            new_session_id = str(uuid.uuid4())
            match.video_session_id = new_session_id
            
            # Create new video session for mutual match (keep in waiting status)
            session = create_video_session(db, match)
            db.commit()
    else:
        # For non-mutual matches, follow original logic
        if match.call_completed:
            raise HTTPException(status_code=400, detail="Call already completed for this match")
        
        # Check if video session already exists
        existing_session = db.query(VideoSession).filter(VideoSession.match_id == match.id).first()
        
        if existing_session:
            if existing_session.status == "completed":
                raise HTTPException(status_code=400, detail="Call already completed")
            else:
                # Return the existing waiting session (don't start until both users join)
                session = existing_session
        else:
            # Create new video session (keep in waiting status)
            session = create_video_session(db, match)
    
    if not session:
        raise HTTPException(status_code=500, detail="Failed to start video session")
    
    # Don't schedule auto-end yet - only when both users actually join
    # background_tasks.add_task(auto_end_session, session.session_id, db)
    
    # Initialize WebRTC signaling storage for this session
    if session.session_id not in webrtc_signals:
        webrtc_signals[session.session_id] = []
    
    return session

@router.get("/session/{session_id}", response_model=VideoSessionResponse)
async def get_video_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get video session details"""
    session = db.query(VideoSession).filter(VideoSession.session_id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Video session not found")
    
    # Check if this is a regular match or instant call session
    if session.match_id:
        # Regular match - check authorization normally
        match = db.query(Match).filter(Match.id == session.match_id).first()
        if not match or current_user.id not in [match.user_id, match.matched_user_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
    else:
        # Instant call session - check authorization and validate active matching
        call_session = db.query(InstantCallSession).filter(InstantCallSession.session_id == session_id).first()
        
        if not call_session:
            raise HTTPException(status_code=404, detail="Call session not found")
        
        # Check if user is part of this call session
        if current_user.id not in [call_session.user1_id, call_session.user2_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
        
        # 🎯 CRITICAL: Validate both users still have active matching sessions
        now = datetime.now(timezone.utc)
        active_cutoff = now - timedelta(minutes=30)  # Must be active within last 30 minutes (more lenient for video calls)
        
        user1_active = db.query(MatchingSession).filter(
            and_(
                MatchingSession.user_id == call_session.user1_id,
                MatchingSession.status == "active",
                MatchingSession.last_active >= active_cutoff
            )
        ).first()
        
        user2_active = db.query(MatchingSession).filter(
            and_(
                MatchingSession.user_id == call_session.user2_id,
                MatchingSession.status == "active",
                MatchingSession.last_active >= active_cutoff
            )
        ).first()
        
        # 🎯 PROACTIVE FIX: Update both users' matching sessions since they're accessing the video call
        # This prevents race conditions where last_active appears stale due to navigation timing
        current_time = datetime.now(timezone.utc)
        
        if user1_active:
            user1_active.last_active = current_time
        if user2_active:
            user2_active.last_active = current_time
            
        # If either user is not actively matching, cancel the call session
        if not user1_active or not user2_active:
            call_session.status = "cancelled"
            session.status = "cancelled"
            db.commit()
            
            inactive_user = "user1" if not user1_active else "user2"
            print(f"🚫 Cancelled call session {call_session.id} - {inactive_user} no longer actively matching")
            print(f"🔍 Debug - User1 active: {bool(user1_active)}, User2 active: {bool(user2_active)}")
            print(f"🔍 Active cutoff time: {active_cutoff}")
            
            # Get detailed info about why each user failed validation
            user1_sessions = db.query(MatchingSession).filter(MatchingSession.user_id == call_session.user1_id).all()
            user2_sessions = db.query(MatchingSession).filter(MatchingSession.user_id == call_session.user2_id).all()
            
            print(f"🔍 User 1 matching sessions:")
            for session in user1_sessions:
                print(f"  📋 Session {session.session_id[:8]}: status={session.status}, last_active={session.last_active}")
                if session.last_active:
                    time_diff = now - session.last_active
                    print(f"      ⏱️  Time since active: {time_diff.total_seconds():.1f} seconds")
                    print(f"      ✅ Meets cutoff: {session.last_active >= active_cutoff}")
            
            print(f"🔍 User 2 matching sessions:")
            for session in user2_sessions:
                print(f"  📋 Session {session.session_id[:8]}: status={session.status}, last_active={session.last_active}")
                if session.last_active:
                    time_diff = now - session.last_active  
                    print(f"      ⏱️  Time since active: {time_diff.total_seconds():.1f} seconds")
                    print(f"      ✅ Meets cutoff: {session.last_active >= active_cutoff}")
            
            raise HTTPException(status_code=410, detail="Call cancelled - other user is no longer actively matching")
        else:
            # Both users are active - commit the updated timestamps
            db.commit()
            print(f"✅ Both users active for call session {call_session.id} - updated matching session timestamps")
    
    return session

@router.post("/end-call/{session_id}")
async def end_video_call(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """End a video call manually"""
    session = db.query(VideoSession).filter(VideoSession.session_id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Video session not found")
    
    # Check authorization - handle both regular matches and instant call sessions
    if session.match_id:
        # Regular match - check authorization normally
        match = db.query(Match).filter(Match.id == session.match_id).first()
        if not match or current_user.id not in [match.user_id, match.matched_user_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
    else:
        # Instant call session - check authorization differently
        call_session = db.query(InstantCallSession).filter(InstantCallSession.session_id == session_id).first()
        
        if not call_session:
            raise HTTPException(status_code=404, detail="Call session not found")
        
        # Check if user is part of this call session
        if current_user.id not in [call_session.user1_id, call_session.user2_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
            
        print(f"✅ End call authorization passed for instant call session {call_session.id} - User {current_user.id}")
    
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is not active")
    
    ended_session = end_video_session(db, session_id)
    if ended_session:
        return {"message": "Call ended successfully", "session": ended_session}
    else:
        raise HTTPException(status_code=500, detail="Failed to end call")

@router.post("/signal")
async def webrtc_signal(
    signal: WebRTCSignal,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle WebRTC signaling"""
    # Verify session exists and user is authorized
    session = db.query(VideoSession).filter(VideoSession.session_id == signal.session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Video session not found")
    
    # Check authorization - handle both regular matches and instant call sessions
    if session.match_id:
        # Regular match - check authorization normally
        match = db.query(Match).filter(Match.id == session.match_id).first()
        if not match or current_user.id not in [match.user_id, match.matched_user_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
        
        # For regular matches, get the other user for auto-targeting
        other_user_id = match.matched_user_id if match.user_id == current_user.id else match.user_id
    else:
        # Instant call session - check authorization differently
        call_session = db.query(InstantCallSession).filter(InstantCallSession.session_id == signal.session_id).first()
        
        if not call_session:
            raise HTTPException(status_code=404, detail="Call session not found")
        
        # Check if user is part of this call session
        if current_user.id not in [call_session.user1_id, call_session.user2_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
            
        print(f"✅ Send signal authorization passed for instant call session {call_session.id} - User {current_user.id}")
        
        # For instant calls, get the other user for auto-targeting
        other_user_id = call_session.user2_id if call_session.user1_id == current_user.id else call_session.user1_id
    
    # Store signal for the target user
    if signal.session_id not in webrtc_signals:
        webrtc_signals[signal.session_id] = []
    
    # If target_user_id is 0, automatically determine the other user
    target_user_id = signal.target_user_id
    if target_user_id == 0:
        # Use the other_user_id we determined above (works for both regular matches and instant calls)
        target_user_id = other_user_id
        print(f"📡 Auto-setting target_user_id from 0 to {target_user_id} for signal type: {signal.type}")
    
    webrtc_signals[signal.session_id].append({
        "type": signal.type,
        "data": signal.data,
        "from_user_id": current_user.id,
        "target_user_id": target_user_id,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    return {"message": "Signal stored successfully"}

@router.get("/signals/{session_id}")
async def get_webrtc_signals(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get WebRTC signals for a session"""
    # Rate limiting check
    current_time = datetime.utcnow()
    user_id = current_user.id
    
    if user_id not in signal_request_counts:
        signal_request_counts[user_id] = {'count': 0, 'last_reset': current_time}
    
    # Reset count if more than 1 minute has passed
    if (current_time - signal_request_counts[user_id]['last_reset']).total_seconds() > 60:
        signal_request_counts[user_id] = {'count': 0, 'last_reset': current_time}
    
    # Check if user exceeded rate limit (max 60 requests per minute)
    if signal_request_counts[user_id]['count'] >= 60:
        raise HTTPException(
            status_code=429, 
            detail="Too many requests. Video signaling rate limit exceeded. Please wait before retrying."
        )
    
    signal_request_counts[user_id]['count'] += 1
    
    # Verify session exists and user is authorized
    session = db.query(VideoSession).filter(VideoSession.session_id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Video session not found")
    
    # Check authorization - handle both regular matches and instant call sessions
    if session.match_id:
        # Regular match - check authorization normally
        match = db.query(Match).filter(Match.id == session.match_id).first()
        if not match or current_user.id not in [match.user_id, match.matched_user_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
    else:
        # Instant call session - check authorization differently
        call_session = db.query(InstantCallSession).filter(InstantCallSession.session_id == session_id).first()
        
        if not call_session:
            raise HTTPException(status_code=404, detail="Call session not found")
        
        # Check if user is part of this call session
        if current_user.id not in [call_session.user1_id, call_session.user2_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
            
        print(f"✅ Signals authorization passed for instant call session {call_session.id} - User {current_user.id}")
    
    # Get signals targeted to current user
    if session_id in webrtc_signals:
        user_signals = [
            signal for signal in webrtc_signals[session_id]
            if signal["target_user_id"] == current_user.id
        ]
        
        # Remove returned signals to prevent duplicate delivery
        webrtc_signals[session_id] = [
            signal for signal in webrtc_signals[session_id]
            if signal["target_user_id"] != current_user.id
        ]
        
        return {"signals": user_signals}
    
    return {"signals": []}

@router.get("/active-sessions")
async def get_active_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get active video sessions for current user"""
    # Find matches where user is involved
    # Include mutual matches even after call_completed is True
    user_matches = db.query(Match).filter(
        or_(
            Match.user_id == current_user.id,
            Match.matched_user_id == current_user.id
        )
    ).all()
    
    active_sessions = []
    for match in user_matches:
        # For mutual matches, always check for active sessions
        # For non-mutual matches, only check if call not completed
        if match.status == "matched" or not match.call_completed:
            session = db.query(VideoSession).filter(
                and_(
                    VideoSession.match_id == match.id,
                    VideoSession.status.in_(["waiting", "active"])
                )
            ).first()
            
            if session:
                # Get the other user's name for display
                other_user_id = match.matched_user_id if match.user_id == current_user.id else match.user_id
                other_user = db.query(User).filter(User.id == other_user_id).first()
                other_user_name = other_user.profile.name if other_user and other_user.profile else "Unknown"
                
                active_sessions.append({
                    "session_id": session.session_id,
                    "status": session.status,
                    "match_id": match.id,
                    "started_at": session.started_at,
                    "is_mutual_match": match.status == "matched",
                    "other_user_name": other_user_name
                })
    
    return {"active_sessions": active_sessions}

@router.get("/pending-calls")
async def get_pending_calls(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get video calls that are waiting for the current user to join"""
    # Find active/waiting video sessions for matches where this user is involved
    user_matches = db.query(Match).filter(
        or_(
            Match.user_id == current_user.id,
            Match.matched_user_id == current_user.id
        )
    ).all()
    
    pending_calls = []
    processed_matches = set()  # Track processed matches to avoid duplicates
    
    for match in user_matches:
        # Skip if we've already processed this match
        if match.id in processed_matches:
            continue
        processed_matches.add(match.id)
        
        # For mutual matches, always check for waiting sessions
        # For non-mutual matches, only check if call not completed
        if match.status == "matched" or not match.call_completed:
            # Find the most recent session for this match (to avoid duplicates)
            session = db.query(VideoSession).filter(
                and_(
                    VideoSession.match_id == match.id,
                    VideoSession.status.in_(["waiting", "active"])
                )
            ).order_by(VideoSession.created_at.desc()).first()
            
            if session:
                # Check if current user has already joined this session
                user_already_joined = (
                    session.session_id in connected_users and 
                    current_user.id in connected_users[session.session_id]
                )
                
                # Only show as pending if the user hasn't joined yet
                if not user_already_joined:
                    # Get the other user's information
                    other_user_id = match.matched_user_id if match.user_id == current_user.id else match.user_id
                    other_user = db.query(User).filter(User.id == other_user_id).first()
                    other_user_name = other_user.profile.name if other_user and other_user.profile else "Unknown"
                    
                    # Calculate how long ago the call started
                    time_since_start = 0
                    if session.started_at:
                        time_since_start = int((datetime.utcnow() - session.started_at).total_seconds())
                    
                    pending_calls.append({
                        "session_id": session.session_id,
                        "match_id": match.id,
                        "other_user_name": other_user_name,
                        "is_mutual_match": match.status == "matched",
                        "started_at": session.started_at,
                        "seconds_ago": time_since_start,
                        "call_type": "Repeat Call 💕" if match.status == "matched" else "First Call"
                    })
    
    # 🎯 CRITICAL FIX: Also check for instant call sessions from continuous matching
    instant_calls = db.query(InstantCallSession).filter(
        and_(
            or_(
                InstantCallSession.user1_id == current_user.id,
                InstantCallSession.user2_id == current_user.id
            ),
            InstantCallSession.status.in_(["waiting", "active"])
        )
    ).all()
    
    for call_session in instant_calls:
        # Get video session for this call
        video_session = db.query(VideoSession).filter(
            VideoSession.session_id == call_session.session_id
        ).first()
        
        if video_session and video_session.status in ["waiting", "active"]:
            # Check if current user has already joined this session
            user_already_joined = (
                video_session.session_id in connected_users and 
                current_user.id in connected_users[video_session.session_id]
            )
            
            if not user_already_joined:
                # Get the other user's information
                other_user_id = call_session.user2_id if call_session.user1_id == current_user.id else call_session.user1_id
                other_user = db.query(User).filter(User.id == other_user_id).first()
                other_user_name = other_user.profile.name if other_user and other_user.profile else "Unknown"
                
                # Calculate how long ago the call started
                time_since_start = 0
                if video_session.started_at:
                    time_since_start = int((datetime.utcnow() - video_session.started_at).total_seconds())
                
                pending_calls.append({
                    "session_id": video_session.session_id,
                    "match_id": 0,  # No match_id for instant calls
                    "other_user_name": other_user_name,
                    "is_mutual_match": False,  # Instant calls are not mutual matches yet
                    "started_at": video_session.started_at,
                    "seconds_ago": time_since_start,
                    "call_type": "Instant Match 🚀"
                })
    
    return {"pending_calls": pending_calls}

@router.get("/call-history/{match_id}")
async def get_call_history(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get video call history for a specific match"""
    match = get_match_by_id(db, match_id)
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Check if user is part of this match
    if current_user.id not in [match.user_id, match.matched_user_id]:
        raise HTTPException(status_code=403, detail="Not authorized for this match")
    
    # Get all video sessions for this match
    video_sessions = db.query(VideoSession).filter(
        VideoSession.match_id == match_id
    ).order_by(VideoSession.started_at.desc()).all()
    
    call_history = []
    for session in video_sessions:
        duration_minutes = 0
        if session.started_at and session.ended_at:
            duration = session.ended_at - session.started_at
            duration_minutes = max(1, int(duration.total_seconds() / 60))  # Minimum 1 minute
        
        call_history.append({
            "session_id": session.session_id,
            "status": session.status,
            "started_at": session.started_at,
            "ended_at": session.ended_at,
            "duration_minutes": duration_minutes
        })
    
    return {
        "match_id": match_id,
        "is_mutual_match": match.status == "matched",
        "total_calls": len(call_history),
        "calls": call_history
    }

@router.post("/join-call/{session_id}")
async def join_video_call(
    session_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark user as joined to video call - starts timer when both users join"""
    # Get session
    session = db.query(VideoSession).filter(VideoSession.session_id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Video session not found")
    
    # Check authorization - handle both regular matches and instant call sessions
    if session.match_id:
        # Regular match - check authorization normally
        match = get_match_by_id(db, session.match_id)
        if not match or current_user.id not in [match.user_id, match.matched_user_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this video session")
        expected_users = {match.user_id, match.matched_user_id}
    else:
        # Instant call session - check authorization differently
        call_session = db.query(InstantCallSession).filter(InstantCallSession.session_id == session_id).first()
        
        if not call_session:
            raise HTTPException(status_code=404, detail="Call session not found")
        
        # Check if user is part of this call session
        if current_user.id not in [call_session.user1_id, call_session.user2_id]:
            raise HTTPException(status_code=403, detail="Not authorized for this session")
        
        expected_users = {call_session.user1_id, call_session.user2_id}
        
        # 🎯 PROACTIVE FIX: Update matching sessions for instant calls
        current_time = datetime.now(timezone.utc)
        
        user1_session = db.query(MatchingSession).filter(
            and_(
                MatchingSession.user_id == call_session.user1_id,
                MatchingSession.status == "active"
            )
        ).first()
        
        user2_session = db.query(MatchingSession).filter(
            and_(
                MatchingSession.user_id == call_session.user2_id,
                MatchingSession.status == "active"
            )
        ).first()
        
        if user1_session:
            user1_session.last_active = current_time
        if user2_session:
            user2_session.last_active = current_time
            
        db.commit()
        print(f"✅ Updated matching sessions for instant call join - User {current_user.id} joining session {session_id}")
    
    # Track this user as connected
    if session_id not in connected_users:
        connected_users[session_id] = set()
    
    connected_users[session_id].add(current_user.id)
    print(f"👥 User {current_user.id} joined session {session_id}. Connected users: {connected_users[session_id]}")
    
    # Check if both users are now connected
    connected_session_users = connected_users[session_id]
    
    if expected_users.issubset(connected_session_users) and session.status == "waiting":
        print(f"🎉 Both users connected to session {session_id}! Starting 1-minute timer...")
        
        # Start the session (mark as active and set started_at)
        session.status = "active"
        session.started_at = datetime.utcnow()
        db.commit()
        
        # Now schedule auto-end after 1 minute
        background_tasks.add_task(auto_end_session, session_id)
        
        return {
            "message": "Video call started! Both users connected.",
            "session_status": "active",
            "timer_started": True,
            "duration": session.duration
        }
    
    return {
        "message": "Joined video call. Waiting for other user...",
        "session_status": session.status,
        "timer_started": False,
        "connected_users": len(connected_session_users),
        "waiting_for": 2 - len(connected_session_users)
    }
