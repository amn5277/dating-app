from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database import get_db, User, Profile, Interest
from routers.auth import get_current_user

router = APIRouter()

# Pydantic models
class InterestResponse(BaseModel):
    id: int
    name: str
    category: str

    class Config:
        from_attributes = True

class ProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=18, le=100)
    gender: str = Field(..., pattern="^(male|female|other)$")
    location: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    
    # Personality traits (1-10 scale)
    extroversion: int = Field(5, ge=1, le=10)
    openness: int = Field(5, ge=1, le=10)
    conscientiousness: int = Field(5, ge=1, le=10)
    agreeableness: int = Field(5, ge=1, le=10)
    neuroticism: int = Field(5, ge=1, le=10)
    
    # Dating preferences
    looking_for: str = Field(..., pattern="^(serious|casual|friends|networking)$")
    min_age: int = Field(18, ge=18, le=100)
    max_age: int = Field(100, ge=18, le=100)
    max_distance: int = Field(50, ge=1, le=500)
    
    # Interest IDs
    interest_ids: List[int] = []

class ProfileResponse(BaseModel):
    id: int
    name: str
    age: int
    gender: str
    location: Optional[str]
    bio: Optional[str]
    extroversion: int
    openness: int
    conscientiousness: int
    agreeableness: int
    neuroticism: int
    looking_for: str
    min_age: int
    max_age: int
    max_distance: int
    interests: List[InterestResponse] = []

    class Config:
        from_attributes = True

class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    age: Optional[int] = Field(None, ge=18, le=100)
    gender: Optional[str] = Field(None, pattern="^(male|female|other)$")
    location: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=500)
    
    extroversion: Optional[int] = Field(None, ge=1, le=10)
    openness: Optional[int] = Field(None, ge=1, le=10)
    conscientiousness: Optional[int] = Field(None, ge=1, le=10)
    agreeableness: Optional[int] = Field(None, ge=1, le=10)
    neuroticism: Optional[int] = Field(None, ge=1, le=10)
    
    looking_for: Optional[str] = Field(None, pattern="^(serious|casual|friends|networking)$")
    min_age: Optional[int] = Field(None, ge=18, le=100)
    max_age: Optional[int] = Field(None, ge=18, le=100)
    max_distance: Optional[int] = Field(None, ge=1, le=500)
    
    interest_ids: Optional[List[int]] = None

# Helper functions
def get_profile_by_user_id(db: Session, user_id: int):
    return db.query(Profile).filter(Profile.user_id == user_id).first()

def create_profile(db: Session, profile: ProfileCreate, user_id: int):
    # Create profile
    db_profile = Profile(
        user_id=user_id,
        **{k: v for k, v in profile.dict().items() if k != 'interest_ids'}
    )
    db.add(db_profile)
    db.flush()
    
    # Add interests
    if profile.interest_ids:
        interests = db.query(Interest).filter(Interest.id.in_(profile.interest_ids)).all()
        user = db.query(User).filter(User.id == user_id).first()
        user.interests = interests
    
    db.commit()
    db.refresh(db_profile)
    return db_profile

def update_profile(db: Session, profile_id: int, profile_update: ProfileUpdate):
    db_profile = db.query(Profile).filter(Profile.id == profile_id).first()
    if not db_profile:
        return None
    
    # Update profile fields
    for key, value in profile_update.dict(exclude_unset=True, exclude={'interest_ids'}).items():
        setattr(db_profile, key, value)
    
    # Update interests if provided
    if profile_update.interest_ids is not None:
        interests = db.query(Interest).filter(Interest.id.in_(profile_update.interest_ids)).all()
        user = db.query(User).filter(User.id == db_profile.user_id).first()
        user.interests = interests
    
    db.commit()
    db.refresh(db_profile)
    return db_profile

# Routes
@router.post("/", response_model=ProfileResponse)
async def create_user_profile(
    profile: ProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Check if profile already exists
    existing_profile = get_profile_by_user_id(db, current_user.id)
    if existing_profile:
        raise HTTPException(status_code=400, detail="Profile already exists")
    
    # Validate interest IDs
    if profile.interest_ids:
        existing_interests = db.query(Interest).filter(Interest.id.in_(profile.interest_ids)).count()
        if existing_interests != len(profile.interest_ids):
            raise HTTPException(status_code=400, detail="Some interest IDs are invalid")
    
    return create_profile(db, profile, current_user.id)

@router.get("/", response_model=ProfileResponse)
async def get_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = get_profile_by_user_id(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile

@router.put("/", response_model=ProfileResponse)
async def update_user_profile(
    profile_update: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    profile = get_profile_by_user_id(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    # Validate interest IDs if provided
    if profile_update.interest_ids is not None:
        existing_interests = db.query(Interest).filter(Interest.id.in_(profile_update.interest_ids)).count()
        if existing_interests != len(profile_update.interest_ids):
            raise HTTPException(status_code=400, detail="Some interest IDs are invalid")
    
    updated_profile = update_profile(db, profile.id, profile_update)
    return updated_profile

@router.get("/interests", response_model=List[InterestResponse])
async def get_all_interests(db: Session = Depends(get_db)):
    interests = db.query(Interest).all()
    return interests

@router.post("/seed-interests")
async def seed_interests(db: Session = Depends(get_db)):
    """Seed database with common interests"""
    interests_data = [
        # Hobbies
        {"name": "Reading", "category": "hobbies"},
        {"name": "Gaming", "category": "hobbies"},
        {"name": "Cooking", "category": "hobbies"},
        {"name": "Photography", "category": "hobbies"},
        {"name": "Gardening", "category": "hobbies"},
        {"name": "Art", "category": "hobbies"},
        {"name": "Writing", "category": "hobbies"},
        
        # Sports
        {"name": "Football", "category": "sports"},
        {"name": "Basketball", "category": "sports"},
        {"name": "Tennis", "category": "sports"},
        {"name": "Swimming", "category": "sports"},
        {"name": "Running", "category": "sports"},
        {"name": "Yoga", "category": "sports"},
        {"name": "Gym", "category": "sports"},
        
        # Music
        {"name": "Pop", "category": "music"},
        {"name": "Rock", "category": "music"},
        {"name": "Hip Hop", "category": "music"},
        {"name": "Classical", "category": "music"},
        {"name": "Jazz", "category": "music"},
        {"name": "Electronic", "category": "music"},
        
        # Entertainment
        {"name": "Movies", "category": "entertainment"},
        {"name": "TV Shows", "category": "entertainment"},
        {"name": "Theater", "category": "entertainment"},
        {"name": "Concerts", "category": "entertainment"},
        
        # Travel
        {"name": "Beach", "category": "travel"},
        {"name": "Mountains", "category": "travel"},
        {"name": "Cities", "category": "travel"},
        {"name": "Adventure", "category": "travel"},
        {"name": "Culture", "category": "travel"},
        
        # Food
        {"name": "Italian", "category": "food"},
        {"name": "Asian", "category": "food"},
        {"name": "Mexican", "category": "food"},
        {"name": "Vegetarian", "category": "food"},
        {"name": "Fine Dining", "category": "food"},
    ]
    
    for interest_data in interests_data:
        existing = db.query(Interest).filter(Interest.name == interest_data["name"]).first()
        if not existing:
            interest = Interest(**interest_data)
            db.add(interest)
    
    db.commit()
    return {"message": "Interests seeded successfully"}
