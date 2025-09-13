from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, not_, desc, func
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import json
import uuid

from database import get_db, User, Profile, Match, VideoSession, MatchingSession, InstantCallSession, Interest
from routers.auth import get_current_user
from routers.matching import calculate_compatibility_score
from pydantic import BaseModel

router = APIRouter(prefix="/api/continuous-matching", tags=["continuous-matching"])

class StartMatchingRequest(BaseModel):
    min_age: int = 18
    max_age: int = 100
    preferred_interests: List[str] = []
    personality_weight: float = 0.5

class MatchingSessionResponse(BaseModel):
    session_id: str
    status: str
    matches_made: int
    successful_matches: int
    current_match: Optional[dict] = None

class NextMatchResponse(BaseModel):
    match_found: bool
    match_data: Optional[dict] = None
    session_stats: dict
    message: str

class ContinueDecisionRequest(BaseModel):
    session_id: str
    decision: str  # "continue", "next", or "skip"
    match_id: int

class CallDecisionRequest(BaseModel):
    call_session_id: int
    decision: str  # "like" or "pass"

def cleanup_stale_call_sessions(db: Session):
    """Clean up stale instant call sessions from inactive or completed matching sessions"""
    try:
        # Get all non-completed instant call sessions
        stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)  # 10 minutes old
        
        stale_sessions = db.query(InstantCallSession).filter(
            and_(
                InstantCallSession.status.in_(["waiting", "active"]),
                InstantCallSession.created_at <= stale_cutoff
            )
        ).all()
        
        cleaned_count = 0
        for call_session in stale_sessions:
            # Check if both users still have active matching sessions
            user1_active = db.query(MatchingSession).filter(
                and_(
                    MatchingSession.user_id == call_session.user1_id,
                    MatchingSession.status == "active",
                    MatchingSession.last_active >= stale_cutoff
                )
            ).first()
            
            user2_active = db.query(MatchingSession).filter(
                and_(
                    MatchingSession.user_id == call_session.user2_id,
                    MatchingSession.status == "active",
                    MatchingSession.last_active >= stale_cutoff
                )
            ).first()
            
            # If either user doesn't have an active matching session, cancel the call
            if not user1_active or not user2_active:
                call_session.status = "cancelled"
                cleaned_count += 1
                print(f"🧹 Cancelled stale call session {call_session.id} - users no longer actively matching")
        
        if cleaned_count > 0:
            db.commit()
            print(f"🧹 Cleaned up {cleaned_count} stale call sessions")
            
    except Exception as e:
        print(f"❌ Error cleaning stale call sessions: {e}")
        db.rollback()

def check_bidirectional_exclusion(db: Session, user1_id: int, user2_id: int) -> dict:
    """
    Check if two users have each other excluded in their matching sessions.
    Returns detailed exclusion status for debugging.
    """
    now = datetime.now(timezone.utc)
    session_timeout = now - timedelta(minutes=5)
    
    # Get active matching sessions for both users
    user1_session = db.query(MatchingSession).filter(
        and_(
            MatchingSession.user_id == user1_id,
            MatchingSession.status == "active",
            MatchingSession.last_active >= session_timeout
        )
    ).first()
    
    user2_session = db.query(MatchingSession).filter(
        and_(
            MatchingSession.user_id == user2_id,
            MatchingSession.status == "active",
            MatchingSession.last_active >= session_timeout
        )
    ).first()
    
    # Parse exclusion lists
    user1_excludes_user2 = False
    user2_excludes_user1 = False
    
    if user1_session and user1_session.matched_user_ids:
        try:
            user1_excluded = json.loads(user1_session.matched_user_ids)
            user1_excludes_user2 = user2_id in user1_excluded or str(user2_id) in user1_excluded
        except:
            pass
    
    if user2_session and user2_session.matched_user_ids:
        try:
            user2_excluded = json.loads(user2_session.matched_user_ids)
            user2_excludes_user1 = user1_id in user2_excluded or str(user1_id) in user2_excluded
        except:
            pass
    
    return {
        "user1_has_active_session": bool(user1_session),
        "user2_has_active_session": bool(user2_session),
        "user1_excludes_user2": user1_excludes_user2,
        "user2_excludes_user1": user2_excludes_user1,
        "bidirectional_exclusion": user1_excludes_user2 and user2_excludes_user1,
        "asymmetric_exclusion": user1_excludes_user2 != user2_excludes_user1,
        "can_match": (not user1_excludes_user2) and (not user2_excludes_user1) and user1_session and user2_session
    }

def find_next_active_match(db: Session, matching_session: MatchingSession) -> Optional[User]:
    """
    Find the next available user who is ALSO actively using instant match feature.
    Enforces bidirectional exclusion - both users must be able to see each other.
    """
    
    user = matching_session.user
    user_profile = user.profile
    
    if not user_profile:
        print(f"❌ User {user.id} has no profile - cannot match")
        return None
    
    # Get already matched user IDs from this continuous matching session ONLY
    matched_ids = []
    if matching_session.matched_user_ids:
        try:
            matched_ids = json.loads(matching_session.matched_user_ids)
            # Ensure all IDs are integers for consistent comparison
            matched_ids = [int(id) if isinstance(id, str) and id.isdigit() else id for id in matched_ids]
        except Exception as e:
            print(f"⚠️ Error parsing exclusion list for user {user.id}: {e}")
            matched_ids = []
    
    # Always exclude self
    matched_ids.append(user.id)
    
    # Remove duplicates and ensure integers
    matched_ids = list(set([int(id) for id in matched_ids]))
    
    print(f"🚫 User {user.id} exclusion list: {matched_ids}")
    
    # 🎯 BIDIRECTIONAL MATCHING: Only match with users who ALSO have active MatchingSessions
    # and who DON'T exclude this user
    now = datetime.now(timezone.utc)
    session_timeout = now - timedelta(minutes=5)  # Session expires after 5 minutes of inactivity
    
    # Query for users who are ALSO actively using instant match feature
    active_matchers_query = db.query(User).join(Profile).join(MatchingSession).filter(
        and_(
            User.id.notin_(matched_ids),  # This user doesn't exclude them
            Profile.age >= matching_session.min_age,
            Profile.age <= matching_session.max_age,
            User.is_active == True,
            # 🎯 KEY REQUIREMENT: User must have an active matching session
            MatchingSession.status == "active",
            MatchingSession.last_active >= session_timeout,  # Session still active
            MatchingSession.user_id == User.id  # Ensure proper join
        )
    ).order_by(desc(MatchingSession.last_active))
    
    # Get potential candidates
    potential_candidates = active_matchers_query.limit(100).all()  # Get more for filtering
    
    print(f"🔍 Found {len(potential_candidates)} potential candidates for user {user.id}")
    
    # 🎯 BIDIRECTIONAL EXCLUSION VALIDATION: Filter candidates who can actually match
    valid_candidates = []
    
    for candidate in potential_candidates:
        exclusion_status = check_bidirectional_exclusion(db, user.id, candidate.id)
        
        if exclusion_status["can_match"]:
            valid_candidates.append(candidate)
            print(f"✅ User {candidate.id} ({candidate.profile.name}) is valid match for User {user.id}")
        else:
            print(f"🚫 User {candidate.id} ({candidate.profile.name}) excluded from User {user.id}:")
            print(f"    - User {user.id} excludes User {candidate.id}: {exclusion_status['user1_excludes_user2']}")
            print(f"    - User {candidate.id} excludes User {user.id}: {exclusion_status['user2_excludes_user1']}")
            print(f"    - Asymmetric exclusion detected: {exclusion_status['asymmetric_exclusion']}")
    
    print(f"🎯 Final valid candidates for User {user.id}: {len(valid_candidates)} users")
    
    if valid_candidates:
        selected_match = select_best_match_from_candidates(db, user, valid_candidates, matching_session)
        if selected_match:
            # Double-check bidirectional compatibility before returning
            final_check = check_bidirectional_exclusion(db, user.id, selected_match.id)
            if final_check["can_match"]:
                print(f"🎉 BIDIRECTIONAL MATCH CONFIRMED: User {user.id} ↔ User {selected_match.id}")
                return selected_match
            else:
                print(f"❌ BIDIRECTIONAL MATCH FAILED: User {user.id} ↔ User {selected_match.id}")
                print(f"    Final check result: {final_check}")
    
    print(f"⏳ No bidirectionally available users for User {user.id} - showing search animation")
    return None

def select_best_match_from_candidates(db: Session, user: User, candidates: List[User], matching_session: MatchingSession) -> Optional[User]:
    """Select the best match from a list of candidates using compatibility scoring"""
    
    user_profile = user.profile
    user_interests = user.interests
    
    # Get preferred interests for this session
    preferred_interests = []
    if matching_session.preferred_interests:
        try:
            preferred_interests = json.loads(matching_session.preferred_interests)
        except:
            preferred_interests = []
    
    matches_with_scores = []
    
    for candidate in candidates:
        if not candidate.profile:
            continue
        
        candidate_interests = candidate.interests
        
        # Calculate base compatibility
        base_score = calculate_compatibility_score(
            user_profile,
            candidate.profile,
            user_interests,
            candidate_interests
        )
        
        # Boost score for preferred interests in this session
        if preferred_interests:
            candidate_interest_names = {interest.name for interest in candidate_interests}
            preferred_matches = len(set(preferred_interests).intersection(candidate_interest_names))
            interest_boost = preferred_matches * 0.1  # 0.1 boost per matching preferred interest
            base_score += interest_boost
        
        # Boost score for very recently active users
        time_since_active = datetime.now(timezone.utc) - candidate.last_active if candidate.last_active else timedelta(hours=999)
        if time_since_active.total_seconds() <= 300:  # 5 minutes
            base_score += 0.15
        elif time_since_active.total_seconds() <= 600:  # 10 minutes
            base_score += 0.1
        
        if base_score > 0.2:  # Minimum compatibility threshold
            matches_with_scores.append((candidate, base_score))
    
    if not matches_with_scores:
        return None
    
    # Sort by score and return the best match
    matches_with_scores.sort(key=lambda x: x[1], reverse=True)
    best_match = matches_with_scores[0][0]
    
    return best_match

def create_continuous_call_session(db: Session, matching_session: MatchingSession, matched_user: User) -> InstantCallSession:
    """Create an instant call session (not a match) for continuous matching with deadlock prevention"""
    
    user = matching_session.user
    
    # 🎯 CRITICAL DEADLOCK PREVENTION: Check if a call session already exists between these users
    # Look for recent sessions in BOTH directions within the last 10 minutes
    recent_time = datetime.now(timezone.utc) - timedelta(minutes=10)
    
    existing_session = db.query(InstantCallSession).filter(
        and_(
            or_(
                and_(InstantCallSession.user1_id == user.id, InstantCallSession.user2_id == matched_user.id),
                and_(InstantCallSession.user1_id == matched_user.id, InstantCallSession.user2_id == user.id)
            ),
            InstantCallSession.created_at >= recent_time,  # Recent session
            InstantCallSession.status.in_(["waiting", "active"])
        )
    ).first()
    
    if existing_session:
        print(f"🔄 DEADLOCK PREVENTION: Found existing call session {existing_session.id} between users {user.id} and {matched_user.id}")
        print(f"🎥 Reusing existing video session: {existing_session.session_id}")
        return existing_session
    
    # 🎯 DETERMINISTIC PAIRING: Use lower user ID to prevent race conditions
    # This ensures only one user creates the session even in simultaneous requests
    user1_id = min(user.id, matched_user.id)
    user2_id = max(user.id, matched_user.id)
    
    # Generate video session ID
    video_session_id = str(uuid.uuid4())
    
    # Create instant call session (NOT a match)
    call_session = InstantCallSession(
        session_id=video_session_id,
        user1_id=user1_id,
        user2_id=user2_id,
        status="waiting",
        call_completed=False
    )
    
    try:
        db.add(call_session)
        db.flush()
        
        # 🎯 CRITICAL FIX: Create the actual VideoSession record
        from database import VideoSession, video_participants
        video_session = VideoSession(
            session_id=video_session_id,
            match_id=None,  # No match ID since this is not a match yet
            duration=180,  # 3 minutes - more time for WebRTC connection
            status="waiting"
        )
        
        db.add(video_session)
        db.flush()
        
        # Add participants to the video session
        db.execute(
            video_participants.insert().values([
                {"video_session_id": video_session.id, "user_id": user1_id},
                {"video_session_id": video_session.id, "user_id": user2_id}
            ])
        )
        
        print(f"🎥 Created VideoSession {video_session_id} for instant call (NOT a match yet)")
        
        db.commit()
        print(f"🎯 INSTANT CALL: Created Call Session {call_session.id} between User {user.id} and User {matched_user.id}")
        print(f"🎥 Video session ID: {video_session_id}")
        
        return call_session
        
    except Exception as e:
        print(f"🔄 RACE CONDITION: Failed to create call session (likely duplicate): {e}")
        db.rollback()
        
        # Try to find the existing session created by the other user
        existing_session = db.query(InstantCallSession).filter(
            and_(
                or_(
                    and_(InstantCallSession.user1_id == user1_id, InstantCallSession.user2_id == user2_id),
                    and_(InstantCallSession.user1_id == user2_id, InstantCallSession.user2_id == user1_id)
                ),
                InstantCallSession.created_at >= recent_time
            )
        ).first()
        
        if existing_session:
            print(f"🔄 Found existing call session {existing_session.id} created by other user")
            return existing_session
        else:
            print(f"❌ Failed to create or find call session between users {user.id} and {matched_user.id}")
            raise HTTPException(status_code=500, detail="Failed to create call session")
    
    # Update matching session tracking (but don't increment matches_made since this isn't a match yet)
    matching_session.last_active = datetime.now(timezone.utc)
    
    # Add matched user ID to the list so we don't pair them again in this session
    matched_ids = []
    if matching_session.matched_user_ids:
        try:
            matched_ids = json.loads(matching_session.matched_user_ids)
        except:
            matched_ids = []
    
    matched_ids.append(matched_user.id)
    matching_session.matched_user_ids = json.dumps(matched_ids)
    
    db.commit()
    db.refresh(call_session)
    
    return call_session

@router.post("/start", response_model=MatchingSessionResponse)
async def start_continuous_matching(
    request: StartMatchingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a continuous matching session"""
    
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Complete your profile first")
    
    # Check if user already has an active matching session
    # Clean up stale sessions (older than 30 minutes without activity)
    stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    
    active_sessions = db.query(MatchingSession).filter(
        and_(
            MatchingSession.user_id == current_user.id,
            MatchingSession.status == "active"
        )
    ).all()
    
    # Clean up stale sessions and end old ones
    for session in active_sessions:
        if session.last_active and session.last_active < stale_cutoff:
            print(f"🧹 Cleaning up stale session {session.session_id} (last active: {session.last_active})")
            session.status = "completed"
            session.ended_at = datetime.now(timezone.utc)
        else:
            # End the active session and start a new one
            print(f"🔄 Ending existing active session {session.session_id} to start new one")
            session.status = "completed" 
            session.ended_at = datetime.now(timezone.utc)
    
    # Commit the cleanup
    db.commit()
    
    # Create new matching session
    session_id = str(uuid.uuid4())
    preferred_interests_json = json.dumps(request.preferred_interests) if request.preferred_interests else None
    
    matching_session = MatchingSession(
        session_id=session_id,
        user_id=current_user.id,
        status="active",
        min_age=request.min_age,
        max_age=request.max_age,
        preferred_interests=preferred_interests_json,
        personality_weight=request.personality_weight,
        matched_user_ids=json.dumps([]),
        started_at=datetime.now(timezone.utc)  # Ensure started_at is always set
    )
    
    db.add(matching_session)
    db.commit()
    db.refresh(matching_session)
    
    print(f"🚀 Started continuous matching session {session_id} for user {current_user.id}")
    
    return MatchingSessionResponse(
        session_id=session_id,
        status="active",
        matches_made=0,
        successful_matches=0,
        current_match=None
    )

@router.post("/next-match", response_model=NextMatchResponse)
async def get_next_match(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the next match in the continuous matching session"""
    
    # Get matching session
    matching_session = db.query(MatchingSession).filter(
        and_(
            MatchingSession.session_id == session_id,
            MatchingSession.user_id == current_user.id,
            MatchingSession.status == "active"
        )
    ).first()
    
    if not matching_session:
        raise HTTPException(status_code=404, detail="Matching session not found or expired")
    
    # 🧹 Clean up stale call sessions first
    cleanup_stale_call_sessions(db)
    
    # Update this session's activity to keep it in the active pool
    matching_session.last_active = datetime.now(timezone.utc)
    db.commit()
    
    # 🎯 CRITICAL FIX: First check if someone else has matched with this user
    # Look for recent matches in BOTH directions (because of deterministic user ordering)
    recent_time = datetime.now(timezone.utc) - timedelta(minutes=5)  # Within last 5 minutes
    
    incoming_match = db.query(Match).filter(
        and_(
            or_(
                Match.matched_user_id == current_user.id,  # This user is the secondary
                Match.user_id == current_user.id  # This user is the primary
            ),
            Match.status == "pending",
            Match.created_at >= recent_time,  # Recent match
            Match.video_session_id.isnot(None)  # Has video session
        )
    ).order_by(desc(Match.created_at)).first()
    
    if incoming_match:
        # Determine who the other user is (since users are now stored in deterministic order)
        other_user_id = incoming_match.matched_user_id if incoming_match.user_id == current_user.id else incoming_match.user_id
        print(f"🎯 INSTANT MATCH: User {current_user.id} has a match with User {other_user_id}")
        
        # Get the other user
        matching_user = db.query(User).filter(User.id == other_user_id).first()
        
        if matching_user and matching_user.profile:
            # Prepare match data for the incoming match
            match_data = {
                "match_id": incoming_match.id,
                "video_session_id": incoming_match.video_session_id,
                "user_name": matching_user.profile.name,
                "user_age": matching_user.profile.age,
                "user_bio": matching_user.profile.bio,
                "user_interests": [interest.name for interest in matching_user.interests],
                "compatibility_score": incoming_match.compatibility_score
            }
            
            print(f"🚀 Auto-connecting User {current_user.id} to incoming match video session: {incoming_match.video_session_id}")
            
            # Update session stats only if this is the first time we're notifying about this match
            if not hasattr(matching_session, '_notified_matches'):
                matching_session._notified_matches = set()
            
            if incoming_match.id not in matching_session._notified_matches:
                matching_session.matches_made += 1  
                matching_session._notified_matches.add(incoming_match.id)
                db.commit()
            
            return NextMatchResponse(
                match_found=True,
                match_data=match_data,
                session_stats={
                    "matches_made": matching_session.matches_made,
                    "successful_matches": matching_session.successful_matches
                },
                message="Someone matched with you! Connecting to video call..."
            )
    
    # If no incoming matches, proceed to find a new match
    next_user = find_next_active_match(db, matching_session)
    
    if not next_user:
        return NextMatchResponse(
            match_found=False,
            match_data=None,
            session_stats={
                "matches_made": matching_session.matches_made,
                "successful_matches": matching_session.successful_matches
            },
            message="No one else is looking for an instant match right now. Waiting for someone to join the pool..."
        )
    
    # Create instant call session (NOT a match)
    call_session = create_continuous_call_session(db, matching_session, next_user)
    
    # Calculate compatibility for display purposes
    compatibility_score = calculate_compatibility_score(
        matching_session.user.profile,
        next_user.profile,
        matching_session.user.interests,
        next_user.interests
    )
    
    # Prepare call session data
    match_data = {
        "call_session_id": call_session.id,
        "video_session_id": call_session.session_id,
        "user_name": next_user.profile.name,
        "user_age": next_user.profile.age,
        "user_bio": next_user.profile.bio,
        "user_interests": [interest.name for interest in next_user.interests],
        "compatibility_score": compatibility_score,
        "is_actual_match": False  # This is just a call session, not a match yet
    }
    
    return NextMatchResponse(
        match_found=True,
        match_data=match_data,
        session_stats={
            "matches_made": matching_session.matches_made,
            "successful_matches": matching_session.successful_matches
        },
        message="Found your next match! Starting video call..."
    )

@router.post("/continue-decision")
async def handle_continue_decision(
    request: ContinueDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle user's decision to continue or get next match"""
    
    # Get matching session
    matching_session = db.query(MatchingSession).filter(
        and_(
            MatchingSession.session_id == request.session_id,
            MatchingSession.user_id == current_user.id
        )
    ).first()
    
    if not matching_session:
        raise HTTPException(status_code=404, detail="Matching session not found")
    
    # Get the match - check both Match table and InstantCallSession
    match = db.query(Match).filter(Match.id == request.match_id).first()
    instant_call_session = None
    other_user_id = None
    
    if not match:
        # Check if this is an InstantCallSession ID from continuous matching
        instant_call_session = db.query(InstantCallSession).filter(
            and_(
                InstantCallSession.id == request.match_id,
                or_(
                    InstantCallSession.user1_id == current_user.id,
                    InstantCallSession.user2_id == current_user.id
                )
            )
        ).first()
        
        if not instant_call_session:
            raise HTTPException(status_code=404, detail="Match or InstantCallSession not found")
            
        other_user_id = instant_call_session.user2_id if instant_call_session.user1_id == current_user.id else instant_call_session.user1_id
    else:
        other_user_id = match.matched_user_id if match.user_id == current_user.id else match.user_id
    
    if request.decision == "continue":
        # User wants to continue with this person
        if match:
            match.status = "liked"
            match.status = "matched"  # Assume mutual interest for continuous matching
        elif instant_call_session:
            # For InstantCallSessions, just mark as successful
            pass
            
        matching_session.successful_matches += 1
        db.commit()
        
        return {
            "message": "Great! You can continue video calling with this person.",
            "action": "continue_calling",
            "match_status": "matched"
        }
    
    elif request.decision == "next":
        # User wants to move to next person
        if match:
            match.status = "passed"
        elif instant_call_session:
            instant_call_session.status = "completed"
            
        matching_session.current_match_id = None
        db.commit()
        
        return {
            "message": "Looking for your next match...",
            "action": "find_next_match",
            "match_status": "passed"
        }
        
    elif request.decision == "skip":
        # User is skipping this person (e.g., they cut the call)
        # Mark as passed and add to matched_user_ids to prevent future matching
        
        if match:
            match.status = "passed"
        elif instant_call_session:
            instant_call_session.status = "completed"
            
        matching_session.current_match_id = None
        
        print(f"🔄 SKIP DECISION: User {current_user.id} is skipping User {other_user_id}")
        
        # 1. Add the skipped user to current user's exclusion list
        matched_ids = []
        if matching_session.matched_user_ids:
            try:
                matched_ids = json.loads(matching_session.matched_user_ids)
            except:
                matched_ids = []
        
        # Add the skipped user ID if not already present
        if other_user_id not in matched_ids:
            matched_ids.append(other_user_id)
            matching_session.matched_user_ids = json.dumps(matched_ids)
            print(f"✅ Added User {other_user_id} to User {current_user.id}'s exclusion list")
        
        # 🎯 CRITICAL FIX: Bidirectional exclusion - also add current user to other user's exclusion list
        # This prevents the other user from immediately matching with this user again
        other_user_matching_session = db.query(MatchingSession).filter(
            and_(
                MatchingSession.user_id == other_user_id,
                MatchingSession.status == "active"
            )
        ).first()
        
        if other_user_matching_session:
            print(f"🔄 BIDIRECTIONAL EXCLUSION: Adding User {current_user.id} to User {other_user_id}'s exclusion list")
            
            # Get other user's current exclusion list
            other_matched_ids = []
            if other_user_matching_session.matched_user_ids:
                try:
                    other_matched_ids = json.loads(other_user_matching_session.matched_user_ids)
                    # Ensure consistent integer format
                    other_matched_ids = [int(id) if isinstance(id, str) and id.isdigit() else id for id in other_matched_ids]
                except Exception as e:
                    print(f"⚠️ Error parsing other user's exclusion list: {e}")
                    other_matched_ids = []
            
            # Add current user to other user's exclusion list if not already present
            if current_user.id not in other_matched_ids:
                other_matched_ids.append(current_user.id)
                other_user_matching_session.matched_user_ids = json.dumps(other_matched_ids)
                print(f"✅ BIDIRECTIONAL EXCLUSION COMPLETE: User {current_user.id} ↔ User {other_user_id}")
                print(f"    User {current_user.id} exclusion list: {matched_ids}")
                print(f"    User {other_user_id} exclusion list: {other_matched_ids}")
            else:
                print(f"ℹ️  User {current_user.id} already in User {other_user_id}'s exclusion list")
        else:
            print(f"⚠️  User {other_user_id} has no active matching session - ASYMMETRIC EXCLUSION APPLIED")
            print(f"    Only User {current_user.id} will exclude User {other_user_id}")
            print(f"    User {other_user_id} may still be able to find User {current_user.id} when they restart matching")
        
        # Commit all changes
        db.commit()
        
        # 🎯 VALIDATION: Verify bidirectional exclusion was applied correctly
        final_exclusion_status = check_bidirectional_exclusion(db, current_user.id, other_user_id)
        print(f"🔍 SKIP DECISION VALIDATION: User {current_user.id} ↔ User {other_user_id}")
        print(f"    Final exclusion status: {final_exclusion_status}")
        
        if final_exclusion_status["asymmetric_exclusion"]:
            print(f"⚠️  ASYMMETRIC EXCLUSION DETECTED - This may allow unwanted re-matching!")
        elif final_exclusion_status["bidirectional_exclusion"]:
            print(f"✅ BIDIRECTIONAL EXCLUSION CONFIRMED - Users cannot match again in current sessions")
        else:
            print(f"❓ UNEXPECTED EXCLUSION STATE - Manual investigation may be needed")
        
        return {
            "message": "User skipped - looking for your next match...",
            "action": "find_next_match", 
            "match_status": "skipped",
            "bidirectional_exclusion_applied": final_exclusion_status["bidirectional_exclusion"],
            "exclusion_details": final_exclusion_status
        }
    
    else:
        raise HTTPException(status_code=400, detail=f"Invalid decision: {request.decision}. Must be 'continue', 'next', or 'skip'.")

@router.get("/exclusion-status/{other_user_id}")
async def check_exclusion_status(
    other_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check bidirectional exclusion status between current user and another user.
    Useful for debugging why users can't match.
    """
    exclusion_status = check_bidirectional_exclusion(db, current_user.id, other_user_id)
    
    return {
        "current_user_id": current_user.id,
        "other_user_id": other_user_id,
        "exclusion_details": exclusion_status,
        "explanation": {
            "can_match": "Both users can match (neither excludes the other)",
            "bidirectional_exclusion": "Both users exclude each other (previous call ended)",
            "asymmetric_exclusion": "Only one user excludes the other (should not happen in normal flow)",
            "no_active_sessions": "One or both users don't have active matching sessions"
        }
    }

@router.get("/debug/all-sessions")
async def debug_all_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    DEBUG ENDPOINT: Show all active matching sessions and their exclusion lists.
    Useful for debugging bidirectional exclusion issues.
    """
    now = datetime.now(timezone.utc)
    session_timeout = now - timedelta(minutes=5)
    
    # Get all active matching sessions
    active_sessions = db.query(MatchingSession).filter(
        and_(
            MatchingSession.status == "active",
            MatchingSession.last_active >= session_timeout
        )
    ).all()
    
    sessions_debug = []
    
    for session in active_sessions:
        # Parse exclusion list
        exclusion_list = []
        if session.matched_user_ids:
            try:
                exclusion_list = json.loads(session.matched_user_ids)
            except:
                exclusion_list = []
        
        sessions_debug.append({
            "user_id": session.user_id,
            "user_name": session.user.profile.name if session.user.profile else "No Profile",
            "session_id": session.session_id,
            "exclusion_list": exclusion_list,
            "matches_made": session.matches_made,
            "last_active": session.last_active.isoformat() if session.last_active else None,
            "age_range": f"{session.min_age}-{session.max_age}"
        })
    
    # Check bidirectional exclusion status between all pairs
    bidirectional_exclusions = []
    
    for i, session1 in enumerate(active_sessions):
        for session2 in active_sessions[i+1:]:
            exclusion_status = check_bidirectional_exclusion(db, session1.user_id, session2.user_id)
            if exclusion_status["user1_excludes_user2"] or exclusion_status["user2_excludes_user1"]:
                bidirectional_exclusions.append({
                    "user1_id": session1.user_id,
                    "user1_name": session1.user.profile.name if session1.user.profile else "No Profile",
                    "user2_id": session2.user_id,
                    "user2_name": session2.user.profile.name if session2.user.profile else "No Profile",
                    "exclusion_status": exclusion_status
                })
    
    return {
        "debug_info": "All active matching sessions and their exclusion lists",
        "current_user_id": current_user.id,
        "total_active_sessions": len(active_sessions),
        "active_sessions": sessions_debug,
        "bidirectional_exclusions": bidirectional_exclusions,
        "exclusion_summary": {
            "total_exclusion_pairs": len(bidirectional_exclusions),
            "bidirectional_pairs": len([e for e in bidirectional_exclusions if e["exclusion_status"]["bidirectional_exclusion"]]),
            "asymmetric_pairs": len([e for e in bidirectional_exclusions if e["exclusion_status"]["asymmetric_exclusion"]])
        }
    }

@router.get("/session/{session_id}")
async def get_matching_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get matching session details"""
    
    matching_session = db.query(MatchingSession).filter(
        and_(
            MatchingSession.session_id == session_id,
            MatchingSession.user_id == current_user.id
        )
    ).first()
    
    if not matching_session:
        raise HTTPException(status_code=404, detail="Matching session not found")
    
    # Get current match details if exists
    current_match_data = None
    if matching_session.current_match_id:
        current_match = db.query(Match).filter(Match.id == matching_session.current_match_id).first()
        if current_match:
            other_user = current_match.matched_user if current_match.user_id == current_user.id else current_match.user
            current_match_data = {
                "match_id": current_match.id,
                "video_session_id": current_match.video_session_id,
                "user_name": other_user.profile.name if other_user.profile else "Unknown",
                "user_age": other_user.profile.age if other_user.profile else 0,
                "status": current_match.status
            }
    
    return MatchingSessionResponse(
        session_id=matching_session.session_id,
        status=matching_session.status,
        matches_made=matching_session.matches_made,
        successful_matches=matching_session.successful_matches,
        current_match=current_match_data
    )

@router.post("/end-session/{session_id}")
async def end_matching_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """End the continuous matching session"""
    
    try:
        matching_session = db.query(MatchingSession).filter(
            and_(
                MatchingSession.session_id == session_id,
                MatchingSession.user_id == current_user.id
            )
        ).first()
        
        if not matching_session:
            raise HTTPException(status_code=404, detail="Matching session not found")
        
        # Check if session is already completed
        if matching_session.status == "completed":
            print(f"⚠️ Session {session_id} is already completed")
        
        matching_session.status = "completed"
        matching_session.ended_at = datetime.now(timezone.utc)
        
        # 🧹 Cancel any pending call sessions for this user
        pending_call_sessions = db.query(InstantCallSession).filter(
            and_(
                or_(
                    InstantCallSession.user1_id == current_user.id,
                    InstantCallSession.user2_id == current_user.id
                ),
                InstantCallSession.status.in_(["waiting", "active"])
            )
        ).all()
        
        cancelled_count = 0
        for call_session in pending_call_sessions:
            call_session.status = "cancelled"
            cancelled_count += 1
            print(f"🚫 Cancelled call session {call_session.id} - user stopped matching")
        
        if cancelled_count > 0:
            print(f"🧹 Cancelled {cancelled_count} pending call sessions for user {current_user.id}")
        
        db.commit()
        print(f"✅ Successfully ended matching session {session_id}")
        
    except HTTPException:
        # Re-raise HTTPExceptions (like 404)
        raise
    except Exception as e:
        print(f"❌ Error ending matching session {session_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to end matching session")
    
    # Calculate duration safely, handling case where started_at might be None
    duration_minutes = 0
    if matching_session.started_at:
        try:
            duration_seconds = (datetime.now(timezone.utc) - matching_session.started_at).total_seconds()
            duration_minutes = max(0, int(duration_seconds / 60))  # Ensure non-negative
        except Exception as e:
            print(f"⚠️ Error calculating session duration: {e}")
            duration_minutes = 0
    
    return {
        "message": "Matching session ended successfully",
        "stats": {
            "matches_made": matching_session.matches_made,
            "successful_matches": matching_session.successful_matches,
            "duration_minutes": duration_minutes
        }
    }

@router.post("/call-decision")
async def submit_call_decision(
    decision_request: CallDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit post-call decision and create actual match only if both users say 'yes'"""
    try:
        # Find the call session
        call_session = db.query(InstantCallSession).filter(
            InstantCallSession.id == decision_request.call_session_id
        ).first()
        
        if not call_session:
            raise HTTPException(status_code=404, detail="Call session not found")
        
        # Determine which user is making the decision
        if current_user.id == call_session.user1_id:
            call_session.user1_decision = decision_request.decision
        elif current_user.id == call_session.user2_id:
            call_session.user2_decision = decision_request.decision
        else:
            raise HTTPException(status_code=403, detail="You are not part of this call session")
        
        db.commit()
        print(f"💝 User {current_user.id} decided '{decision_request.decision}' for call session {call_session.id}")
        
        # Check if both users have made decisions
        if call_session.user1_decision and call_session.user2_decision:
            print(f"🎯 Both users have decided: {call_session.user1_decision} and {call_session.user2_decision}")
            
            # If both users liked each other, create an actual match
            if call_session.user1_decision == "like" and call_session.user2_decision == "like":
                print(f"💕 MUTUAL MATCH! Creating actual match between users {call_session.user1_id} and {call_session.user2_id}")
                
                # Get the users for the match
                user1 = db.query(User).filter(User.id == call_session.user1_id).first()
                user2 = db.query(User).filter(User.id == call_session.user2_id).first()
                
                # Calculate compatibility score
                compatibility_score = calculate_compatibility_score(
                    user1.profile,
                    user2.profile,
                    user1.interests,
                    user2.interests
                )
                
                # Create the actual match
                match = Match(
                    user_id=call_session.user1_id,
                    matched_user_id=call_session.user2_id,
                    compatibility_score=compatibility_score,
                    status="matched",  # Mutual match!
                    call_completed=True,
                    user_decision="like",
                    matched_user_decision="like",
                    video_session_id=call_session.session_id  # Link to the video session
                )
                
                db.add(match)
                
                # Update matching sessions' successful_matches count
                user1_sessions = db.query(MatchingSession).filter(
                    MatchingSession.user_id == call_session.user1_id,
                    MatchingSession.status == "active"
                ).all()
                user2_sessions = db.query(MatchingSession).filter(
                    MatchingSession.user_id == call_session.user2_id,
                    MatchingSession.status == "active"
                ).all()
                
                for session in user1_sessions + user2_sessions:
                    session.successful_matches += 1
                    session.matches_made += 1
                
                # Mark call session as completed
                call_session.status = "completed"
                
                db.commit()
                print(f"🎉 MATCH CREATED: Match {match.id} between users {call_session.user1_id} and {call_session.user2_id}")
                
                return {
                    "mutual_match": True,
                    "match_id": match.id,
                    "message": "🎉 It's a mutual match! You can now see this person in your matches.",
                    "other_user_decision": call_session.user2_decision if current_user.id == call_session.user1_id else call_session.user1_decision
                }
            else:
                print(f"💔 No mutual match. Decisions: User1={call_session.user1_decision}, User2={call_session.user2_decision}")
                
                # Mark call session as completed
                call_session.status = "completed"
                db.commit()
                
                return {
                    "mutual_match": False,
                    "message": "Thanks for your decision! Keep looking for your perfect match.",
                    "other_user_decision": call_session.user2_decision if current_user.id == call_session.user1_id else call_session.user1_decision
                }
        else:
            return {
                "decision_submitted": True,
                "message": "Your decision has been recorded. Waiting for the other person to decide...",
                "waiting_for_other": True
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error processing call decision: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to process call decision")
