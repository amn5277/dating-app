from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio
import uvicorn
import os
from dotenv import load_dotenv

from database import engine, Base
from routers import auth, profile, matching, video

load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Video Dating App", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(matching.router, prefix="/api/matching", tags=["matching"])
app.include_router(video.router, prefix="/api/video", tags=["video"])

# Socket.IO for real-time communication
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["http://localhost:3000"]
)

socket_app = socketio.ASGIApp(sio, app)

# WebSocket connection manager for video calls
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.rooms: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        if room_id not in self.rooms:
            self.rooms[room_id] = []
        self.rooms[room_id].append(websocket)

    def disconnect(self, websocket: WebSocket, room_id: str):
        self.active_connections.remove(websocket)
        if room_id in self.rooms:
            self.rooms[room_id].remove(websocket)

    async def send_to_room(self, message: dict, room_id: str):
        if room_id in self.rooms:
            for connection in self.rooms[room_id]:
                await connection.send_json(message)

manager = ConnectionManager()

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.send_to_room(data, room_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)

@app.get("/")
async def root():
    return {"message": "Video Dating App API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
