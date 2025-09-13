import uuid
import math
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, not_
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from database import get_db, User, Profile, Match, Interest, VideoSession, user_interests
from routers.auth import get_current_user

router = APIRouter()

# Pydantic models
class MatchRequest(BaseModel):
    pass  # For now, we'll find matches automatically

class MatchResponse(BaseModel):
    id: int
    user_id: int
    matched_user_id: int
    compatibility_score: float
    status: str
    video_session_id: Optional[str]
    call_completed: bool
    
    # Matched user profile info
    matched_user_name: str
    matched_user_age: int
    matched_user_bio: Optional[str]
    matched_user_interests: List[str] = []

    class Config:
        from_attributes = True

class SwipeRequest(BaseModel):
    match_id: int
    decision: str  # "like" or "pass"

class UnmatchRequest(BaseModel):
    match_id: int

# Helper functions
def calculate_compatibility_score(user_profile: Profile, other_profile: Profile, user_interests: List[Interest], other_interests: List[Interest]) -> float:
    """
    Calculate compatibility score between two users based on:
    1. Personality traits compatibility
    2. Shared interests
    3. Age preferences
    4. Looking for compatibility
    """
    score = 0.0
    
    # 1. Personality traits compatibility (40% weight)
    personality_score = 0.0
    
    # Extroversion compatibility (opposites can attract, but similar is good too)
    ext_diff = abs(user_profile.extroversion - other_profile.extroversion)
    personality_score += max(0, 10 - ext_diff) / 10
    
    # Other traits - prefer similar values
    trait_diffs = [
        abs(user_profile.openness - other_profile.openness),
        abs(user_profile.conscientiousness - other_profile.conscientiousness),
        abs(user_profile.agreeableness - other_profile.agreeableness),
        abs(user_profile.neuroticism - other_profile.neuroticism)
    ]
    
    for diff in trait_diffs:
        personality_score += max(0, 10 - diff) / 10
    
    personality_score = (personality_score / 5) * 0.4  # Normalize and apply weight
    score += personality_score
    
    # 2. Shared interests (30% weight)
    user_interest_names = {interest.name for interest in user_interests}
    other_interest_names = {interest.name for interest in other_interests}
    
    if user_interest_names and other_interest_names:
        shared_interests = len(user_interest_names.intersection(other_interest_names))
        total_interests = len(user_interest_names.union(other_interest_names))
        interest_score = shared_interests / total_interests if total_interests > 0 else 0
    else:
        interest_score = 0
    
    score += interest_score * 0.3
    
    # 3. Age preferences compatibility (20% weight)
    age_score = 0.0
    if (user_profile.min_age <= other_profile.age <= user_profile.max_age and
        other_profile.min_age <= user_profile.age <= other_profile.max_age):
        age_score = 1.0
    
    score += age_score * 0.2
    
    # 4. Looking for compatibility (10% weight)
    looking_for_score = 0.0
    if user_profile.looking_for == other_profile.looking_for:
        looking_for_score = 1.0
    elif (user_profile.looking_for in ["serious", "casual"] and 
          other_profile.looking_for in ["serious", "casual"]):
        looking_for_score = 0.5
    
    score += looking_for_score * 0.1
    
    return min(1.0, max(0.0, score))

def find_potential_matches(db: Session, user: User, limit: int = 10) -> List[User]:
    """Find potential matches for a user, prioritizing active/online users"""
    user_profile = user.profile
    if not user_profile:
        return []
    
    # Get users who:
    # 1. Have complete profiles
    # 2. Haven't been matched with current user before
    # 3. Meet age and gender preferences
    # 4. Are not the current user
    # 5. Prioritize recently active users
    
    # Get existing match user IDs (both directions)
    existing_matches = db.query(Match).filter(
        or_(
            Match.user_id == user.id,
            Match.matched_user_id == user.id
        )
    ).all()
    
    existing_match_ids = set()
    for match in existing_matches:
        existing_match_ids.add(match.user_id)
        existing_match_ids.add(match.matched_user_id)
    existing_match_ids.discard(user.id)  # Remove current user ID
    
    # Query for potential matches, ordered by recent activity
    # Get more users to filter and rank, prioritizing recently active ones
    query = db.query(User).join(Profile).filter(
        and_(
            User.id != user.id,
            User.id.notin_(existing_match_ids),
            Profile.age >= user_profile.min_age,
            Profile.age <= user_profile.max_age,
            User.is_active == True
        )
    ).order_by(User.last_active.desc())  # Order by most recently active first
    
    potential_matches = query.limit(limit * 5).all()  # Get more to filter and rank
    
    # Calculate compatibility scores and sort
    matches_with_scores = []
    for potential_match in potential_matches:
        if not potential_match.profile:
            continue
            
        # Get interests for both users
        user_interests = user.interests
        match_interests = potential_match.interests
        
        score = calculate_compatibility_score(
            user_profile, 
            potential_match.profile,
            user_interests,
            match_interests
        )
        
        # Add bonus for recently active users
        now = datetime.now(timezone.utc)
        if potential_match.last_active:
            time_since_active = now - potential_match.last_active
            
            # Active within last 10 minutes: +0.2 bonus
            if time_since_active.total_seconds() <= 600:  # 10 minutes
                score += 0.2
                print(f"🟢 ACTIVE user {potential_match.profile.name}: +0.2 bonus (active {time_since_active.total_seconds()/60:.1f}min ago)")
            # Active within last hour: +0.1 bonus  
            elif time_since_active.total_seconds() <= 3600:  # 1 hour
                score += 0.1
                print(f"🟡 RECENT user {potential_match.profile.name}: +0.1 bonus (active {time_since_active.total_seconds()/60:.1f}min ago)")
            # Active within last 24 hours: +0.05 bonus
            elif time_since_active.total_seconds() <= 86400:  # 24 hours
                score += 0.05
                print(f"🔵 RECENT user {potential_match.profile.name}: +0.05 bonus (active {time_since_active.total_seconds()/3600:.1f}hrs ago)")
        
        if score > 0.25:  # Lower threshold to include more active users
            matches_with_scores.append((potential_match, score))
    
    # Sort by compatibility score
    matches_with_scores.sort(key=lambda x: x[1], reverse=True)
    
    return [match[0] for match in matches_with_scores[:limit]]

def create_match(db: Session, user_id: int, matched_user_id: int, compatibility_score: float) -> Match:
    """Create a new match between two users"""
    video_session_id = str(uuid.uuid4())
    
    match = Match(
        user_id=user_id,
        matched_user_id=matched_user_id,
        compatibility_score=compatibility_score,
        video_session_id=video_session_id,
        status="pending"
    )
    
    db.add(match)
    db.commit()
    db.refresh(match)
    return match

# Routes
@router.post("/find", response_model=List[MatchResponse])
async def find_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Find potential matches for the current user"""
    if not current_user.profile:
        raise HTTPException(status_code=400, detail="Complete your profile first")
    
    potential_matches = find_potential_matches(db, current_user)
    
    if not potential_matches:
        return []
    
    # Create matches and return them
    matches = []
    for potential_match in potential_matches:
        # Calculate compatibility score again for accuracy
        user_interests = current_user.interests
        match_interests = potential_match.interests
        
        compatibility_score = calculate_compatibility_score(
            current_user.profile,
            potential_match.profile,
            user_interests,
            match_interests
        )
        
        # Create match in database
        match = create_match(db, current_user.id, potential_match.id, compatibility_score)
        
        # Prepare response
        match_response = MatchResponse(
            id=match.id,
            user_id=match.user_id,
            matched_user_id=match.matched_user_id,
            compatibility_score=match.compatibility_score,
            status=match.status,
            video_session_id=match.video_session_id,
            call_completed=match.call_completed,
            matched_user_name=potential_match.profile.name,
            matched_user_age=potential_match.profile.age,
            matched_user_bio=potential_match.profile.bio,
            matched_user_interests=[interest.name for interest in match_interests]
        )
        matches.append(match_response)
    
    return matches

@router.get("/", response_model=List[MatchResponse])
async def get_user_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all ACTUAL matches for the current user (only mutual matches after video call + mutual yes)"""
    matches = db.query(Match).filter(
        and_(
            or_(
                Match.user_id == current_user.id,
                Match.matched_user_id == current_user.id
            ),
            Match.status == "matched"  # Only show mutual matches (both said yes)
        )
    ).all()
    
    response_matches = []
    for match in matches:
        # Determine which user is the "other" user
        if match.user_id == current_user.id:
            other_user = match.matched_user
        else:
            other_user = match.user
        
        if not other_user.profile:
            continue
        
        match_response = MatchResponse(
            id=match.id,
            user_id=match.user_id,
            matched_user_id=match.matched_user_id,
            compatibility_score=match.compatibility_score,
            status=match.status,
            video_session_id=match.video_session_id,
            call_completed=match.call_completed,
            matched_user_name=other_user.profile.name,
            matched_user_age=other_user.profile.age,
            matched_user_bio=other_user.profile.bio,
            matched_user_interests=[interest.name for interest in other_user.interests]
        )
        response_matches.append(match_response)
    
    return response_matches

@router.post("/swipe")
async def swipe_on_match(
    swipe: SwipeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record user's swipe decision after video call"""
    match = db.query(Match).filter(Match.id == swipe.match_id).first()
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Check if user is part of this match
    if current_user.id not in [match.user_id, match.matched_user_id]:
        raise HTTPException(status_code=403, detail="Not authorized to swipe on this match")
    
    if not match.call_completed:
        raise HTTPException(status_code=400, detail="Complete the video call first")
    
    # Record the decision
    if current_user.id == match.user_id:
        match.user_decision = swipe.decision
    else:
        match.matched_user_decision = swipe.decision
    
    # Check if both users have made decisions
    if match.user_decision and match.matched_user_decision:
        if match.user_decision == "like" and match.matched_user_decision == "like":
            match.status = "matched"
        else:
            match.status = "rejected"
    
    db.commit()
    
    return {
        "message": "Swipe recorded successfully",
        "match_status": match.status,
        "is_mutual_match": match.status == "matched"
    }

@router.get("/mutual")
async def get_mutual_matches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all mutual matches (both users liked each other)"""
    matches = db.query(Match).filter(
        and_(
            or_(
                Match.user_id == current_user.id,
                Match.matched_user_id == current_user.id
            ),
            Match.status == "matched"
        )
    ).all()
    
    return [{"match_id": match.id, "video_session_id": match.video_session_id} for match in matches]

@router.post("/unmatch")
async def unmatch_user(
    unmatch_request: UnmatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Unmatch with another user"""
    match = db.query(Match).filter(Match.id == unmatch_request.match_id).first()
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Check if user is part of this match
    if current_user.id not in [match.user_id, match.matched_user_id]:
        raise HTTPException(status_code=403, detail="Not authorized to unmatch this user")
    
    # Set status to unmatched
    match.status = "unmatched"
    
    # Clear any pending decisions
    match.user_decision = None
    match.matched_user_decision = None
    
    # End any active video session
    if match.video_session_id:
        video_session = db.query(VideoSession).filter(
            VideoSession.session_id == match.video_session_id
        ).first()
        if video_session and video_session.status == "active":
            video_session.status = "cancelled"
    
    db.commit()
    
    return {
        "message": "Successfully unmatched",
        "match_id": match.id
    }

@router.get("/active-users")
async def get_active_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get information about currently active users"""
    
    now = datetime.now(timezone.utc)
    
    # Count users by activity level
    active_10min = db.query(User).filter(
        and_(
            User.is_active == True,
            User.last_active >= now - timedelta(minutes=10)
        )
    ).count()
    
    active_1hour = db.query(User).filter(
        and_(
            User.is_active == True,
            User.last_active >= now - timedelta(hours=1)
        )
    ).count()
    
    active_24hours = db.query(User).filter(
        and_(
            User.is_active == True,
            User.last_active >= now - timedelta(hours=24)
        )
    ).count()
    
    # Get active users with profiles
    recent_users = db.query(User).join(Profile).filter(
        and_(
            User.is_active == True,
            User.last_active >= now - timedelta(hours=1),
            User.id != current_user.id
        )
    ).order_by(User.last_active.desc()).limit(10).all()
    
    active_profiles = []
    for user in recent_users:
        if user.profile:
            time_since_active = now - user.last_active if user.last_active else timedelta(days=999)
            active_profiles.append({
                "name": user.profile.name,
                "age": user.profile.age,
                "minutes_ago": int(time_since_active.total_seconds() / 60),
                "status": "🟢 Online" if time_since_active.total_seconds() <= 600 else "🟡 Recent"
            })
    
    return {
        "online_now": active_10min,
        "active_last_hour": active_1hour,
        "active_today": active_24hours,
        "recent_active_users": active_profiles
    }
