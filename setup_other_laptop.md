# Setup Video Dating App on Another Laptop

## Quick Setup for Second Laptop

### 1. Clone/Copy Project
```bash
# If you have git
git clone <your-repo-url>

# Or copy the project folder via USB/network share
```

### 2. Install Dependencies
```bash
# Frontend
cd frontend
npm install
npm start  # Will run on http://localhost:3000

# Backend - Update API URL in frontend
# Edit frontend/src/utils/api.ts
# Change API_BASE_URL to: http://10.100.1.151:8004
```

### 3. Access App
- Frontend: `http://localhost:3000` (camera will work!)
- Backend: Still uses `http://10.100.1.151:8004` (via network)

## Benefits
✅ Camera access works (localhost is secure context)
✅ Backend still on main laptop
✅ No HTTPS setup needed
