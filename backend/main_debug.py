from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os
from dotenv import load_dotenv

print("🔍 Step 1: Basic imports successful")

try:
    from database import engine, Base
    print("🔍 Step 2: Database imports successful")
except Exception as e:
    print(f"❌ Database import failed: {e}")
    exit(1)

load_dotenv()
print("🔍 Step 3: Environment loaded")

app = FastAPI(title="Debug Version", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("🔍 Step 4: FastAPI app created")

@app.get("/")
async def root():
    return {"message": "Debug API - No database operations yet"}

@app.get("/test-db")
async def test_database():
    try:
        # Try to create tables
        print("🔍 Attempting to create database tables...")
        Base.metadata.create_all(bind=engine)
        print("🔍 Database tables created successfully!")
        return {"status": "database_ok", "message": "Database operations successful"}
    except Exception as e:
        print(f"❌ Database operation failed: {e}")
        return {"status": "database_error", "error": str(e)}

if __name__ == "__main__":
    print("🔍 Step 5: Starting server on port 8002...")
    uvicorn.run("main_debug:app", host="127.0.0.1", port=8002, reload=False)
