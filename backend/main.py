from fastapi import FastAPI
from api.attendance import router as attendance_router
from models.database import Base, engine
from fastapi.middleware.cors import CORSMiddleware




app = FastAPI()
# Middleware to handle CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


Base.metadata.create_all(bind=engine)





app.include_router(attendance_router)


@app.get("/test")
def test_endpoint():
    return {"message": "Server is working"}
