from fastapi import FastAPI
from api.attendance import router as attendance_router


app = FastAPI()


app.include_router(attendance_router, prefix="/api/attendance")