from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

from database import engine, Base, User

load_dotenv()
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Video Dating App - Fixed", version="1.0.0")

# CORS middleware - Allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("🔍 About to import routers one by one...")

# Import and include routers one by one to avoid circular import issues
try:
    print("🔍 Importing auth router...")
    from routers import auth
    app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
    print("✅ Auth router included successfully")
except Exception as e:
    print(f"❌ Auth router failed: {e}")

try:
    print("🔍 Importing profile router...")
    from routers import profile
    app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
    print("✅ Profile router included successfully")
except Exception as e:
    print(f"❌ Profile router failed: {e}")

try:
    print("🔍 Importing matching router...")
    from routers import matching
    app.include_router(matching.router, prefix="/api/matching", tags=["matching"])
    print("✅ Matching router included successfully")
except Exception as e:
    print(f"❌ Matching router failed: {e}")

try:
    print("🔍 Importing video router...")
    from routers import video
    app.include_router(video.router, prefix="/api/video", tags=["video"])
    print("✅ Video router included successfully")
except Exception as e:
    print(f"❌ Video router failed: {e}")

try:
    print("🔍 Importing continuous matching router...")
    from routers import continuous_matching
    app.include_router(continuous_matching.router, tags=["continuous-matching"])
    print("✅ Continuous matching router included successfully")
except Exception as e:
    print(f"❌ Continuous matching router failed: {e}")

@app.get("/")
async def root():
    return {"message": "Video Dating App API - Fixed Version"}

@app.get("/health")
async def health():
    return {"status": "healthy", "routers": ["auth", "profile", "matching", "video", "continuous-matching"]}

@app.get("/debug/users")
async def debug_users():
    """Debug endpoint to see all users"""
    from database import SessionLocal
    db = SessionLocal()
    try:
        users = db.query(User).all()
        return {
            "total_users": len(users),
            "users": [{"id": u.id, "email": u.email, "is_active": u.is_active} for u in users]
        }
    finally:
        db.close()

if __name__ == "__main__":
    import socket
    import os
    
    # Get the local IP address
    try:
        # Connect to a remote address to determine the local IP
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        local_ip = sock.getsockname()[0]
        sock.close()
    except:
        local_ip = "Unable to determine"
    
    # Use PORT environment variable for deployment platforms like Railway, Heroku
    PORT = int(os.getenv("PORT", 8004))
    # Disable reload in production
    RELOAD = os.getenv("ENVIRONMENT", "development") == "development"
    
    print("🌐 Starting Video Dating App Backend Server...")
    print(f"🔗 Local access: http://localhost:{PORT}")
    print(f"🔗 Network access: http://{local_ip}:{PORT}")
    print(f"📖 API Documentation: http://{local_ip}:{PORT}/docs")
    print(f"💚 Health check: http://{local_ip}:{PORT}/health")
    print(f"🔍 Starting server on all network interfaces (0.0.0.0:{PORT})...")
    
    uvicorn.run("main_fixed:app", host="0.0.0.0", port=PORT, reload=RELOAD)
