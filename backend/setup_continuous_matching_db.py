#!/usr/bin/env python3
"""
Setup script for continuous matching database tables
Run this to create the new MatchingSession table and relationships
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base, User, MatchingSession
from sqlalchemy import text
import sqlite3

def setup_continuous_matching_db():
    """Create the matching_sessions table and update relationships"""
    print("🔄 Setting up continuous matching database...")
    
    try:
        # Create all tables (this will create new ones and skip existing ones)
        print("📋 Creating database tables...")
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully!")
        
        # Check if the matching_sessions table exists
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='matching_sessions';
            """))
            
            if result.fetchone():
                print("✅ matching_sessions table created successfully!")
                
                # Check table structure
                result = conn.execute(text("PRAGMA table_info(matching_sessions);"))
                columns = result.fetchall()
                print(f"📋 Table has {len(columns)} columns:")
                for col in columns:
                    print(f"   - {col[1]} ({col[2]})")
                
            else:
                print("❌ matching_sessions table not found!")
                return False
        
        print("\n🎉 Continuous matching database setup complete!")
        print("\n📋 Next steps:")
        print("1. Restart your backend server: python3 main_fixed.py")
        print("2. Open frontend and try the 'Start Matching' button")
        print("3. Test with multiple users on different devices")
        
        return True
        
    except Exception as e:
        print(f"❌ Error setting up database: {e}")
        return False

def check_database_status():
    """Check current database status"""
    print("🔍 Checking database status...")
    
    try:
        with engine.connect() as conn:
            # Check all tables
            result = conn.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                ORDER BY name;
            """))
            
            tables = result.fetchall()
            print(f"📋 Found {len(tables)} tables:")
            for table in tables:
                print(f"   ✅ {table[0]}")
            
            # Check if we have any matching sessions
            if any('matching_sessions' in str(table) for table in tables):
                result = conn.execute(text("SELECT COUNT(*) FROM matching_sessions;"))
                count = result.fetchone()[0]
                print(f"📊 Matching sessions in database: {count}")
            
            # Check active users
            result = conn.execute(text("""
                SELECT COUNT(*) FROM users 
                WHERE is_active = 1 AND datetime(last_active) > datetime('now', '-1 hour');
            """))
            active_count = result.fetchone()[0]
            print(f"👥 Active users (last hour): {active_count}")
            
    except Exception as e:
        print(f"❌ Error checking database: {e}")

if __name__ == "__main__":
    print("🎯 Continuous Matching Database Setup")
    print("=" * 40)
    
    # Check current status
    check_database_status()
    print()
    
    # Setup new tables
    success = setup_continuous_matching_db()
    
    if success:
        print("\n" + "=" * 40)
        print("🚀 Ready to test continuous matching!")
        print("=" * 40)
    else:
        print("\n" + "=" * 40) 
        print("❌ Setup failed - check errors above")
        print("=" * 40)
        sys.exit(1)
