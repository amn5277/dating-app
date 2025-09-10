from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

from database import engine, Base

print("🔍 Step 1: Database imports successful")

load_dotenv()
Base.metadata.create_all(bind=engine)
print("🔍 Step 2: Database tables created")

app = FastAPI(title="Debug Router Imports", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("🔍 Step 3: FastAPI app ready")

@app.get("/")
async def root():
    return {"message": "Router debug - testing router imports"}

@app.get("/test-auth")
async def test_auth_import():
    try:
        print("🔍 Testing auth router import...")
        from routers import auth
        print("✅ Auth router imported successfully")
        return {"status": "success", "message": "Auth router imported"}
    except Exception as e:
        print(f"❌ Auth router import failed: {e}")
        return {"status": "error", "error": str(e)}

@app.get("/test-profile")
async def test_profile_import():
    try:
        print("🔍 Testing profile router import...")
        from routers import profile
        print("✅ Profile router imported successfully") 
        return {"status": "success", "message": "Profile router imported"}
    except Exception as e:
        print(f"❌ Profile router import failed: {e}")
        return {"status": "error", "error": str(e)}

@app.get("/test-matching")
async def test_matching_import():
    try:
        print("🔍 Testing matching router import...")
        from routers import matching
        print("✅ Matching router imported successfully")
        return {"status": "success", "message": "Matching router imported"}
    except Exception as e:
        print(f"❌ Matching router import failed: {e}")
        return {"status": "error", "error": str(e)}

if __name__ == "__main__":
    print("🔍 Step 4: Starting server on port 8003...")
    uvicorn.run("main_debug2:app", host="127.0.0.1", port=8003, reload=False)
