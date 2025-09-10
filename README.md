# VideoDate - Personality-Based Video Dating App

A modern, full-stack dating application that connects people through personality compatibility and authentic 1-minute video conversations. Skip the endless swiping and connect with people who truly match your interests and traits.

## 🌟 Features

### Core Functionality
- **Personality-Based Matching**: Advanced algorithm that matches users based on Big Five personality traits, shared interests, and dating preferences
- **1-Minute Video Dates**: Quick, authentic video conversations with potential matches (like Omegle/Monkey but for dating)
- **Smart Compatibility Scoring**: Calculates compatibility based on personality traits, interests, age preferences, and relationship goals
- **Post-Call Swiping**: Make decisions (like/pass) after getting to know someone through video chat
- **Mutual Matching**: Only users who both "like" each other can continue chatting

### Technical Features
- **Real-time Video Calling**: WebRTC-powered video calls with automatic 1-minute timer
- **Modern UI/UX**: Beautiful, responsive interface built with React, TypeScript, and Tailwind CSS
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **RESTful API**: FastAPI backend with comprehensive endpoints
- **Database Integration**: SQLAlchemy ORM with PostgreSQL/SQLite support

## 🏗️ Architecture

```
├── backend/                    # FastAPI Backend
│   ├── routers/               # API route handlers
│   │   ├── auth.py           # Authentication endpoints
│   │   ├── profile.py        # User profile management
│   │   ├── matching.py       # Matching algorithm & logic
│   │   └── video.py          # Video call management
│   ├── database.py           # Database models & config
│   ├── main.py              # FastAPI application entry
│   └── requirements.txt     # Python dependencies
│
├── frontend/                  # React Frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── auth/         # Login/Register components
│   │   │   ├── profile/      # Profile creation & management
│   │   │   ├── matching/     # Matching & swiping interfaces
│   │   │   └── video/        # Video call component
│   │   ├── store/           # Zustand state management
│   │   ├── utils/           # API utilities & helpers
│   │   └── App.tsx          # Main app component
│   ├── package.json         # Node.js dependencies
│   └── tailwind.config.js   # Tailwind CSS configuration
│
└── README.md                # This file
```

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables** (create `.env` file):
   ```env
   DATABASE_URL=sqlite:///./dating_app.db
   SECRET_KEY=your-super-secret-key-change-this-in-production
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   ```

5. **Start the backend server**:
   ```bash
   python main.py
   ```
   The API will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables** (create `.env` file):
   ```env
   REACT_APP_API_URL=http://localhost:8000
   ```

4. **Start the frontend server**:
   ```bash
   npm start
   ```
   The app will be available at `http://localhost:3000`

## 📱 How It Works

### 1. User Registration & Profile Creation
- Users create accounts with email/password
- Complete detailed profiles including:
  - Basic info (name, age, gender, location)
  - Personality traits (Big Five model: extroversion, openness, conscientiousness, agreeableness, neuroticism)
  - Interests across multiple categories
  - Dating preferences (age range, relationship goals, distance)

### 2. Matching Algorithm
The app uses a sophisticated compatibility scoring system:

- **Personality Compatibility (40%)**: Analyzes Big Five traits for compatibility
- **Shared Interests (30%)**: Calculates overlap in hobbies, music, sports, etc.
- **Age Preferences (20%)**: Ensures mutual age compatibility
- **Relationship Goals (10%)**: Matches based on what users are seeking

### 3. Video Dating Process
1. **Find Matches**: Algorithm finds compatible users
2. **Video Call**: 1-minute authentic video conversation
3. **Decision**: Both users swipe like/pass after the call
4. **Mutual Matches**: Only mutual likes can continue chatting

### 4. WebRTC Video Implementation
- Peer-to-peer video calling using WebRTC
- STUN servers for NAT traversal
- Automatic call termination after 60 seconds
- Real-time signaling through polling mechanism

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **CORS Protection**: Configured for secure cross-origin requests
- **Input Validation**: Comprehensive validation using Pydantic
- **SQL Injection Protection**: SQLAlchemy ORM prevents injection attacks

## 🎨 UI/UX Features

- **Modern Glass Morphism Design**: Beautiful, modern interface with glass effects
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Smooth Animations**: Framer Motion for delightful user interactions
- **Toast Notifications**: Real-time feedback for user actions
- **Loading States**: Comprehensive loading indicators
- **Error Handling**: Graceful error handling and user feedback

## 🗄️ Database Schema

### Users Table
- Basic authentication info
- Account status and timestamps

### Profiles Table
- Personal information and preferences
- Personality trait scores (1-10 scale)
- Dating preferences and criteria

### Interests Table
- Categorized interest options
- Many-to-many relationship with users

### Matches Table
- Match records between users
- Compatibility scores and status
- Video session tracking

### Video Sessions Table
- Video call metadata and status
- Duration and participant tracking

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/token` - Login/get access token
- `GET /api/auth/me` - Get current user info

### Profile Management
- `POST /api/profile/` - Create user profile
- `GET /api/profile/` - Get user profile
- `PUT /api/profile/` - Update profile
- `GET /api/profile/interests` - Get all interests

### Matching System
- `POST /api/matching/find` - Find new matches
- `GET /api/matching/` - Get user's matches
- `POST /api/matching/swipe` - Record swipe decision
- `GET /api/matching/mutual` - Get mutual matches

### Video Calls
- `POST /api/video/start-call` - Start video session
- `GET /api/video/session/{id}` - Get session info
- `POST /api/video/end-call/{id}` - End video session
- `POST /api/video/signal` - WebRTC signaling
- `GET /api/video/signals/{id}` - Get WebRTC signals

## 🚀 Deployment

### Backend Deployment (Production)

1. **Use PostgreSQL** (update DATABASE_URL):
   ```env
   DATABASE_URL=postgresql://username:password@localhost/dating_app
   ```

2. **Install production server**:
   ```bash
   pip install gunicorn
   ```

3. **Run with Gunicorn**:
   ```bash
   gunicorn main:socket_app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```

### Frontend Deployment

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Serve static files** with nginx, Apache, or any static file server

### Environment Variables for Production

**Backend (.env)**:
```env
DATABASE_URL=postgresql://username:password@localhost/dating_app
SECRET_KEY=your-super-secure-secret-key-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

**Frontend (.env)**:
```env
REACT_APP_API_URL=https://your-api-domain.com
```

## 🧪 Development

### Seeding Data
The app includes an endpoint to seed common interests:
```bash
curl -X POST http://localhost:8000/api/profile/seed-interests
```

### Testing the Flow
1. Register two accounts
2. Complete both profiles with different personality traits and interests
3. Use "Find Matches" to create matches
4. Start video calls and test the full flow

## 📝 Future Enhancements

### Immediate Improvements
- [ ] Real-time messaging system for mutual matches
- [ ] Push notifications for new matches and calls
- [ ] Photo upload and management
- [ ] Advanced filtering and search

### Advanced Features
- [ ] Location-based matching with GPS
- [ ] Video call recording and replay
- [ ] AI-powered conversation starters
- [ ] Social media integration
- [ ] Premium subscription features

### Technical Improvements
- [ ] Redis for session management and caching
- [ ] WebSocket for real-time communication
- [ ] TURN servers for better WebRTC connectivity
- [ ] Comprehensive test suite
- [ ] CI/CD pipeline setup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- FastAPI for the excellent backend framework
- React team for the amazing frontend library
- WebRTC community for video calling standards
- Tailwind CSS for the utility-first CSS framework

---

**Built with ❤️ for authentic human connections**

For questions or support, please open an issue in the repository.
