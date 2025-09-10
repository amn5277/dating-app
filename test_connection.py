#!/usr/bin/env python3
"""
Test script to verify both frontend and backend are working properly
"""
import requests
import json
import sys

def test_backend():
    """Test if backend API is responding"""
    try:
        print("🧪 Testing Backend API...")
        response = requests.get('http://localhost:8000/', timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Backend API working: {data}")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Backend not responding - make sure server is running on port 8000")
        return False
    except Exception as e:
        print(f"❌ Backend error: {e}")
        return False

def test_frontend():
    """Test if frontend is responding"""
    try:
        print("🧪 Testing Frontend...")
        response = requests.get('http://localhost:3000/', timeout=5)
        if response.status_code == 200:
            print("✅ Frontend is running on port 3000")
            return True
        else:
            print(f"❌ Frontend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Frontend not responding - make sure React dev server is running on port 3000")
        return False
    except Exception as e:
        print(f"❌ Frontend error: {e}")
        return False

def test_api_endpoint():
    """Test a specific API endpoint"""
    try:
        print("🧪 Testing API Documentation...")
        response = requests.get('http://localhost:8000/docs', timeout=5)
        if response.status_code == 200:
            print("✅ API Documentation accessible at http://localhost:8000/docs")
            return True
        else:
            print(f"❌ API docs returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ API docs error: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Video Dating App Connection Test")
    print("=" * 50)
    
    backend_ok = test_backend()
    frontend_ok = test_frontend()
    docs_ok = test_api_endpoint()
    
    print("\n" + "=" * 50)
    print("📋 SUMMARY:")
    print(f"Backend API: {'✅' if backend_ok else '❌'}")
    print(f"Frontend: {'✅' if frontend_ok else '❌'}")
    print(f"API Docs: {'✅' if docs_ok else '❌'}")
    
    if backend_ok and frontend_ok:
        print("\n🎉 Both servers are running! Open http://localhost:3000 in your browser")
        print("🔗 API Documentation: http://localhost:8000/docs")
    else:
        print("\n❌ Some services are not running. Please check the server status.")
        print("\nTo start servers:")
        print("Backend: cd backend && source venv/bin/activate && python3 main.py")
        print("Frontend: cd frontend && npm start")
    
    sys.exit(0 if (backend_ok and frontend_ok) else 1)
