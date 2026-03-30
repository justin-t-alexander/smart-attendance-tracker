from fastapi import FastAPI
from api.attendance import router as attendance_router  # existing
from models.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "ws://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# Include routers
app.include_router(attendance_router)

# This is a simple test endpoint to verify that the server is running
@app.get("/test")
def test_endpoint():
    return {"message": "Server is working"}
