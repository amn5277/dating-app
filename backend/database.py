from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, Float, ForeignKey, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./dating_app.db")

# Fix Railway PostgreSQL URLs that use postgres:// instead of postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Association table for user interests (many-to-many)
user_interests = Table(
    'user_interests',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('interest_id', Integer, ForeignKey('interests.id'), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_active = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationship to profile
    profile = relationship("Profile", back_populates="user", uselist=False)
    
    # Relationships for matching
    sent_matches = relationship("Match", foreign_keys="Match.user_id", back_populates="user")
    received_matches = relationship("Match", foreign_keys="Match.matched_user_id", back_populates="matched_user")
    
    # Matching sessions for continuous matching
    matching_sessions = relationship("MatchingSession", back_populates="user")
    
    # Video sessions - temporarily disabled to fix relationship issues
    # video_sessions = relationship("VideoSession", secondary=video_participants, back_populates="participants")

class Interest(Base):
    __tablename__ = "interests"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    category = Column(String, nullable=False)  # e.g., "hobbies", "music", "sports", etc.
    
    # Users with this interest
    users = relationship("User", secondary=user_interests, back_populates="interests")

# Add the interests relationship to User
User.interests = relationship("Interest", secondary=user_interests, back_populates="users")

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # Basic info
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    location = Column(String)
    bio = Column(Text)
    
    # Personality traits (1-10 scale)
    extroversion = Column(Integer, default=5)
    openness = Column(Integer, default=5)
    conscientiousness = Column(Integer, default=5)
    agreeableness = Column(Integer, default=5)
    neuroticism = Column(Integer, default=5)
    
    # Dating preferences
    looking_for = Column(String)  # "serious", "casual", "friends", etc.
    min_age = Column(Integer, default=18)
    max_age = Column(Integer, default=100)
    max_distance = Column(Integer, default=50)  # in miles/km
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="profile")

class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    matched_user_id = Column(Integer, ForeignKey("users.id"))
    
    # Match status
    status = Column(String, default="pending")  # "pending", "matched", "rejected"
    compatibility_score = Column(Float)
    
    # Video call related
    video_session_id = Column(String, unique=True)  # UUID for video room
    call_completed = Column(Boolean, default=False)
    
    # Swipe decisions after call
    user_decision = Column(String)  # "like", "pass"
    matched_user_decision = Column(String)  # "like", "pass"
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="sent_matches")
    matched_user = relationship("User", foreign_keys=[matched_user_id], back_populates="received_matches")

class VideoSession(Base):
    __tablename__ = "video_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, nullable=False)  # UUID
    match_id = Column(Integer, ForeignKey("matches.id"))
    
    # Session details
    started_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    duration = Column(Integer, default=60)  # 1 minute in seconds
    status = Column(String, default="waiting")  # "waiting", "active", "completed", "cancelled"
    
    # Participants
    participants = relationship("User", secondary="video_participants")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class MatchingSession(Base):
    __tablename__ = "matching_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, unique=True, nullable=False)  # UUID
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Session state
    status = Column(String, default="active")  # "active", "paused", "completed"
    current_match_id = Column(Integer, ForeignKey("matches.id"), nullable=True)
    matches_made = Column(Integer, default=0)
    successful_matches = Column(Integer, default=0)
    
    # Preferences for this session
    min_age = Column(Integer, default=18)
    max_age = Column(Integer, default=100)
    preferred_interests = Column(String, nullable=True)  # JSON string
    personality_weight = Column(Float, default=0.5)
    
    # Tracking
    matched_user_ids = Column(String, default="")  # JSON array of already matched user IDs
    
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    last_active = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="matching_sessions")


# Association table for video session participants
video_participants = Table(
    'video_participants',
    Base.metadata,
    Column('video_session_id', Integer, ForeignKey('video_sessions.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True)
)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
