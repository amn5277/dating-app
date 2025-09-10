from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, not_, desc, func
from datetime import datetime, timedelta
from typing import List, Optional
import json
import uuid

from database import get_db, User, Profile, Match, VideoSession, MatchingSession, Interest
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
    decision: str  # "continue" or "next"
    match_id: int

def find_next_active_match(db: Session, matching_session: MatchingSession) -> Optional[User]:
    """Find the next available active user for continuous matching"""
    
    user = matching_session.user
    user_profile = user.profile
    
    if not user_profile:
        return None
    
    # Get already matched user IDs from this continuous matching session ONLY
    # In continuous matching (like Omegle/Monkey), users can rematch with anyone active
    # We only exclude users already matched in THIS session to avoid immediate repeats
    matched_ids = []
    if matching_session.matched_user_ids:
        try:
            matched_ids = json.loads(matching_session.matched_user_ids)
        except:
            matched_ids = []
    
    # Always exclude self
    matched_ids.append(user.id)
    
    # Remove duplicates
    matched_ids = list(set(matched_ids))
    
    # Find active users within the last 10 minutes (very active)
    # or within the last hour (recently active)
    now = datetime.utcnow()
    very_active_cutoff = now - timedelta(minutes=10)
    recently_active_cutoff = now - timedelta(hours=1)
    
    # Query for potential matches
    base_query = db.query(User).join(Profile).filter(
        and_(
            User.id.notin_(matched_ids),
            Profile.age >= matching_session.min_age,
            Profile.age <= matching_session.max_age,
            User.is_active == True,
            User.last_active >= recently_active_cutoff  # Only recently active users
        )
    )
    
    # First try very active users (last 10 minutes)
    very_active_users = base_query.filter(
        User.last_active >= very_active_cutoff
    ).order_by(desc(User.last_active)).limit(20).all()
    
    if very_active_users:
        return select_best_match_from_candidates(db, user, very_active_users, matching_session)
    
    # If no very active users, try recently active (last hour)
    recently_active_users = base_query.order_by(desc(User.last_active)).limit(50).all()
    
    if recently_active_users:
        return select_best_match_from_candidates(db, user, recently_active_users, matching_session)
    
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
        time_since_active = datetime.utcnow() - candidate.last_active if candidate.last_active else timedelta(hours=999)
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

def create_continuous_match(db: Session, matching_session: MatchingSession, matched_user: User) -> Match:
    """Create a match for continuous matching session"""
    
    # Calculate compatibility for record keeping
    user = matching_session.user
    compatibility_score = calculate_compatibility_score(
        user.profile,
        matched_user.profile,
        user.interests,
        matched_user.interests
    )
    
    # Create match
    match = Match(
        user_id=user.id,
        matched_user_id=matched_user.id,
        compatibility_score=compatibility_score,
        status="pending",  # Will be updated after video call
        call_completed=False
    )
    
    # Generate video session ID
    match.video_session_id = str(uuid.uuid4())
    
    db.add(match)
    db.flush()
    
    # Update matching session
    matching_session.current_match_id = match.id
    matching_session.matches_made += 1
    matching_session.last_active = datetime.utcnow()
    
    # Add matched user ID to the list
    matched_ids = []
    if matching_session.matched_user_ids:
        try:
            matched_ids = json.loads(matching_session.matched_user_ids)
        except:
            matched_ids = []
    
    matched_ids.append(matched_user.id)
    matching_session.matched_user_ids = json.dumps(matched_ids)
    
    db.commit()
    db.refresh(match)
    
    print(f"🎉 Created continuous match: User {user.id} <-> User {matched_user.id}")
    return match

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
    stale_cutoff = datetime.utcnow() - timedelta(minutes=30)
    
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
            session.ended_at = datetime.utcnow()
        else:
            # End the active session and start a new one
            print(f"🔄 Ending existing active session {session.session_id} to start new one")
            session.status = "completed" 
            session.ended_at = datetime.utcnow()
    
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
        matched_user_ids=json.dumps([])
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
    
    # Find next active match
    next_user = find_next_active_match(db, matching_session)
    
    if not next_user:
        return NextMatchResponse(
            match_found=False,
            match_data=None,
            session_stats={
                "matches_made": matching_session.matches_made,
                "successful_matches": matching_session.successful_matches
            },
            message="No active users found right now. Try again in a few minutes!"
        )
    
    # Create match
    match = create_continuous_match(db, matching_session, next_user)
    
    # Prepare match data
    match_data = {
        "match_id": match.id,
        "video_session_id": match.video_session_id,
        "user_name": next_user.profile.name,
        "user_age": next_user.profile.age,
        "user_bio": next_user.profile.bio,
        "user_interests": [interest.name for interest in next_user.interests],
        "compatibility_score": match.compatibility_score
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
    
    # Get the match
    match = db.query(Match).filter(Match.id == request.match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    if request.decision == "continue":
        # User wants to continue with this person
        match.status = "liked"
        matching_session.successful_matches += 1
        
        # Check if it's a mutual like (other person needs to like back for full match)
        # For continuous matching, we'll assume immediate mutual interest
        # and allow unlimited video calls
        match.status = "matched"
        
        db.commit()
        
        return {
            "message": "Great! You can continue video calling with this person.",
            "action": "continue_calling",
            "match_status": "matched"
        }
    
    else:  # decision == "next"
        # User wants to move to next person
        match.status = "passed"
        matching_session.current_match_id = None
        
        db.commit()
        
        return {
            "message": "Looking for your next match...",
            "action": "find_next_match",
            "match_status": "passed"
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
    
    matching_session = db.query(MatchingSession).filter(
        and_(
            MatchingSession.session_id == session_id,
            MatchingSession.user_id == current_user.id
        )
    ).first()
    
    if not matching_session:
        raise HTTPException(status_code=404, detail="Matching session not found")
    
    matching_session.status = "completed"
    matching_session.ended_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "message": "Matching session ended successfully",
        "stats": {
            "matches_made": matching_session.matches_made,
            "successful_matches": matching_session.successful_matches,
            "duration_minutes": int((datetime.utcnow() - matching_session.started_at).total_seconds() / 60)
        }
    }
