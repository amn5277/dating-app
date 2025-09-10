from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

from database import engine, Base
from routers import auth, profile, matching

load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Video Dating App", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers (WITHOUT video for now)
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(matching.router, prefix="/api/matching", tags=["matching"])

@app.get("/")
async def root():
    return {"message": "Video Dating App API - Simple Version"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is working!"}

if __name__ == "__main__":
    uvicorn.run("main_simple:app", host="0.0.0.0", port=8000, reload=True)
