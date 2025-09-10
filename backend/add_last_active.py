#!/usr/bin/env python3
"""
Migration script to add last_active column to users table
"""
import sqlite3
from datetime import datetime

def migrate_database():
    """Add last_active column to users table"""
    conn = sqlite3.connect('dating_app.db')
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(users);")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'last_active' not in columns:
            print("Adding last_active column to users table...")
            
            # Add the column without default value (SQLite limitation)
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN last_active TIMESTAMP;
            """)
            
            # Update existing users to have current timestamp
            cursor.execute("""
                UPDATE users 
                SET last_active = datetime('now')
                WHERE last_active IS NULL;
            """)
            
            conn.commit()
            print("✅ Successfully added last_active column!")
        else:
            print("ℹ️  last_active column already exists")
            
    except Exception as e:
        print(f"❌ Error during migration: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()
