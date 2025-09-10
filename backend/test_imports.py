#!/usr/bin/env python3
"""
Test script to isolate where the hang occurs
"""
import sys
import traceback

print("🔍 Starting import tests...")

try:
    print("1. Testing basic imports...")
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
    import os
    from dotenv import load_dotenv
    print("✅ Basic imports successful")
except Exception as e:
    print(f"❌ Basic imports failed: {e}")
    sys.exit(1)

try:
    print("2. Testing dotenv loading...")
    load_dotenv()
    print("✅ dotenv loaded successfully")
except Exception as e:
    print(f"❌ dotenv failed: {e}")
    sys.exit(1)

try:
    print("3. Testing SQLAlchemy imports...")
    from sqlalchemy import create_engine
    from sqlalchemy.ext.declarative import declarative_base
    from sqlalchemy.orm import sessionmaker
    print("✅ SQLAlchemy imports successful")
except Exception as e:
    print(f"❌ SQLAlchemy imports failed: {e}")
    traceback.print_exc()
    sys.exit(1)

try:
    print("4. Testing database module import...")
    print("   4a. Importing database...")
    from database import engine
    print("   4b. engine imported successfully")
    from database import Base
    print("   4c. Base imported successfully")
    print("✅ Database module imported successfully")
except Exception as e:
    print(f"❌ Database module import failed: {e}")
    traceback.print_exc()
    sys.exit(1)

try:
    print("5. Testing router imports...")
    print("   5a. Importing auth router...")
    from routers import auth
    print("   5b. auth router imported successfully")
    from routers import profile
    print("   5c. profile router imported successfully")
    from routers import matching
    print("   5d. matching router imported successfully")
    print("✅ All router imports successful")
except Exception as e:
    print(f"❌ Router imports failed: {e}")
    traceback.print_exc()
    sys.exit(1)

try:
    print("6. Testing database table creation...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully")
except Exception as e:
    print(f"❌ Database table creation failed: {e}")
    traceback.print_exc()
    sys.exit(1)

print("🎉 All imports and database operations successful!")
print("The issue might be elsewhere...")
