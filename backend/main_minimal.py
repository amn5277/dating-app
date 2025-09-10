from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Ultra minimal FastAPI app - no database, no routers, no imports
app = FastAPI(title="Minimal Test", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Minimal API is working!"}

@app.get("/test")
async def test():
    return {"status": "success", "test": "This endpoint works"}

if __name__ == "__main__":
    uvicorn.run("main_minimal:app", host="127.0.0.1", port=8001, reload=False)
