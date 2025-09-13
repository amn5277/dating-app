from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from ..database import get_db, PersonalityRating, User, VideoSession, Match
from .auth import get_current_user

router = APIRouter(prefix="/api/personality-ratings", tags=["personality-ratings"])

# Pydantic models for API
class PersonalityRatingCreate(BaseModel):
    """Request model for creating a new personality rating"""
    rated_user_id: int
    video_session_id: Optional[str] = None
    match_id: Optional[int] = None
    
    # Personality trait ratings (1-10 scale)
    friendliness: int = Field(ge=1, le=10, description="How friendly/warm the person was (1-10)")
    conversational_skills: int = Field(ge=1, le=10, description="How good they were at conversation (1-10)")
    sense_of_humor: int = Field(ge=1, le=10, description="How funny/entertaining they were (1-10)")
    intelligence: int = Field(ge=1, le=10, description="How smart/insightful they seemed (1-10)")
    attractiveness: int = Field(ge=1, le=10, description="Physical/overall attractiveness (1-10)")
    authenticity: int = Field(ge=1, le=10, description="How genuine/authentic they seemed (1-10)")
    respect_level: int = Field(ge=1, le=10, description="How respectful they were (1-10)")
    compatibility: int = Field(ge=1, le=10, description="Overall compatibility feeling (1-10)")
    
    # Optional text feedback
    written_feedback: Optional[str] = None

class PersonalityRatingResponse(BaseModel):
    """Response model for personality rating"""
    id: int
    rater_user_id: int
    rated_user_id: int
    video_session_id: Optional[str]
    match_id: Optional[int]
    
    friendliness: int
    conversational_skills: int
    sense_of_humor: int
    intelligence: int
    attractiveness: int
    authenticity: int
    respect_level: int
    compatibility: int
    overall_rating: float
    
    written_feedback: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class RatedUserSummary(BaseModel):
    """Summary of ratings received by a user"""
    user_id: int
    total_ratings: int
    average_overall_rating: float
    average_traits: dict
    recent_feedback: List[str]

@router.post("/submit", response_model=PersonalityRatingResponse)
async def submit_personality_rating(
    rating_data: PersonalityRatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit a personality rating for another user after a video call
    """
    
    # Validate that the user isn't rating themselves
    if rating_data.rated_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot rate yourself")
    
    # Validate user ID is valid (not 0 or negative)
    if rating_data.rated_user_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid user ID for rating")
    
    # Validate that the rated user exists
    rated_user = db.query(User).filter(User.id == rating_data.rated_user_id).first()
    if not rated_user:
        raise HTTPException(status_code=404, detail="Rated user not found")
    
    # Validate that the session/match exists and the user was a participant
    if rating_data.video_session_id:
        session = db.query(VideoSession).filter(VideoSession.session_id == rating_data.video_session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Video session not found")
    
    if rating_data.match_id:
        match = db.query(Match).filter(Match.id == rating_data.match_id).first()
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")
        
        # Verify user was part of this match
        if current_user.id not in [match.user_id, match.matched_user_id]:
            raise HTTPException(status_code=403, detail="You were not a participant in this match")
    
    # Check if user has already rated this person for this session/match
    existing_rating_query = db.query(PersonalityRating).filter(
        and_(
            PersonalityRating.rater_user_id == current_user.id,
            PersonalityRating.rated_user_id == rating_data.rated_user_id
        )
    )
    
    if rating_data.video_session_id:
        existing_rating_query = existing_rating_query.filter(PersonalityRating.video_session_id == rating_data.video_session_id)
    if rating_data.match_id:
        existing_rating_query = existing_rating_query.filter(PersonalityRating.match_id == rating_data.match_id)
        
    existing_rating = existing_rating_query.first()
    if existing_rating:
        raise HTTPException(status_code=400, detail="You have already rated this user for this session")
    
    # Calculate overall rating (average of all traits)
    traits = [
        rating_data.friendliness,
        rating_data.conversational_skills,
        rating_data.sense_of_humor,
        rating_data.intelligence,
        rating_data.attractiveness,
        rating_data.authenticity,
        rating_data.respect_level,
        rating_data.compatibility
    ]
    overall_rating = sum(traits) / len(traits)
    
    # Create the rating
    new_rating = PersonalityRating(
        rater_user_id=current_user.id,
        rated_user_id=rating_data.rated_user_id,
        video_session_id=rating_data.video_session_id,
        match_id=rating_data.match_id,
        friendliness=rating_data.friendliness,
        conversational_skills=rating_data.conversational_skills,
        sense_of_humor=rating_data.sense_of_humor,
        intelligence=rating_data.intelligence,
        attractiveness=rating_data.attractiveness,
        authenticity=rating_data.authenticity,
        respect_level=rating_data.respect_level,
        compatibility=rating_data.compatibility,
        overall_rating=overall_rating,
        written_feedback=rating_data.written_feedback
    )
    
    db.add(new_rating)
    db.commit()
    db.refresh(new_rating)
    
    print(f"✅ User {current_user.id} rated User {rating_data.rated_user_id} - Overall: {overall_rating:.1f}/10")
    
    return new_rating

@router.get("/user/{user_id}/summary", response_model=RatedUserSummary)
async def get_user_rating_summary(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a summary of personality ratings for a specific user
    (Only accessible to the user themselves or for matching purposes)
    """
    
    # For now, allow users to see their own ratings and others' ratings for matching
    # In production, you might want to restrict this further
    
    ratings = db.query(PersonalityRating).filter(PersonalityRating.rated_user_id == user_id).all()
    
    if not ratings:
        return RatedUserSummary(
            user_id=user_id,
            total_ratings=0,
            average_overall_rating=0.0,
            average_traits={},
            recent_feedback=[]
        )
    
    # Calculate averages
    total_ratings = len(ratings)
    avg_overall = sum(r.overall_rating for r in ratings) / total_ratings
    
    # Calculate trait averages
    trait_averages = {
        "friendliness": sum(r.friendliness for r in ratings) / total_ratings,
        "conversational_skills": sum(r.conversational_skills for r in ratings) / total_ratings,
        "sense_of_humor": sum(r.sense_of_humor for r in ratings) / total_ratings,
        "intelligence": sum(r.intelligence for r in ratings) / total_ratings,
        "attractiveness": sum(r.attractiveness for r in ratings) / total_ratings,
        "authenticity": sum(r.authenticity for r in ratings) / total_ratings,
        "respect_level": sum(r.respect_level for r in ratings) / total_ratings,
        "compatibility": sum(r.compatibility for r in ratings) / total_ratings,
    }
    
    # Get recent written feedback (last 5 ratings with feedback)
    recent_feedback = [
        r.written_feedback for r in sorted(ratings, key=lambda x: x.created_at, reverse=True)
        if r.written_feedback
    ][:5]
    
    return RatedUserSummary(
        user_id=user_id,
        total_ratings=total_ratings,
        average_overall_rating=round(avg_overall, 1),
        average_traits={k: round(v, 1) for k, v in trait_averages.items()},
        recent_feedback=recent_feedback
    )

@router.get("/my-ratings-given", response_model=List[PersonalityRatingResponse])
async def get_my_ratings_given(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20
):
    """
    Get personality ratings that the current user has given to others
    """
    ratings = db.query(PersonalityRating).filter(
        PersonalityRating.rater_user_id == current_user.id
    ).order_by(desc(PersonalityRating.created_at)).limit(limit).all()
    
    return ratings

@router.get("/my-ratings-received", response_model=List[PersonalityRatingResponse])
async def get_my_ratings_received(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20
):
    """
    Get personality ratings that the current user has received from others
    """
    ratings = db.query(PersonalityRating).filter(
        PersonalityRating.rated_user_id == current_user.id
    ).order_by(desc(PersonalityRating.created_at)).limit(limit).all()
    
    return ratings
