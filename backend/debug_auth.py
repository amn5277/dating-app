#!/usr/bin/env python3
"""
Debug script to test authentication functions directly
"""
from database import SessionLocal, User
from routers.auth import create_user, authenticate_user, get_user_by_email, verify_password, get_password_hash
from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    password: str

def test_auth_flow():
    db = SessionLocal()
    
    # Test user data
    test_email = "test@example.com"
    test_password = "testpassword123"
    
    print("🧪 Testing Authentication Flow...")
    
    # 1. Test password hashing
    print("1. Testing password hashing...")
    hashed = get_password_hash(test_password)
    print(f"   Original: {test_password}")
    print(f"   Hashed: {hashed[:50]}...")
    
    # 2. Test password verification
    print("2. Testing password verification...")
    is_valid = verify_password(test_password, hashed)
    print(f"   Verification result: {is_valid}")
    
    # 3. Check if user already exists
    print("3. Checking if test user exists...")
    existing_user = get_user_by_email(db, test_email)
    if existing_user:
        print(f"   User exists: ID={existing_user.id}, Email={existing_user.email}")
        
        # Test authentication with existing user
        print("4. Testing authentication with existing user...")
        auth_result = authenticate_user(db, test_email, test_password)
        if auth_result:
            print(f"   ✅ Authentication successful: {auth_result.email}")
        else:
            print("   ❌ Authentication failed")
            
            # Test with wrong password
            print("   Testing with potentially wrong stored password...")
            print(f"   Stored hash: {existing_user.hashed_password[:50]}...")
            wrong_auth = verify_password(test_password, existing_user.hashed_password)
            print(f"   Password match: {wrong_auth}")
    else:
        print("   No existing user found")
        
        # 4. Test user creation
        print("4. Testing user creation...")
        try:
            user_data = UserCreate(email=test_email, password=test_password)
            new_user = create_user(db, user_data)
            print(f"   ✅ User created: ID={new_user.id}, Email={new_user.email}")
            
            # 5. Test authentication with new user
            print("5. Testing authentication with new user...")
            auth_result = authenticate_user(db, test_email, test_password)
            if auth_result:
                print(f"   ✅ Authentication successful: {auth_result.email}")
            else:
                print("   ❌ Authentication failed with new user")
        except Exception as e:
            print(f"   ❌ User creation failed: {e}")
    
    # 6. List all users
    print("6. All users in database:")
    all_users = db.query(User).all()
    for user in all_users:
        print(f"   User: {user.email} (ID: {user.id})")
    
    db.close()

if __name__ == "__main__":
    test_auth_flow()
