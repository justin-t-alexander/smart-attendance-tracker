from fastapi import FastAPI
from api.attendance import router as attendance_router
from models.database import Base, engine


Base.metadata.create_all(bind=engine)



app = FastAPI()


app.include_router(attendance_router)


@app.get("/test")
def test_endpoint():
    return {"message": "Server is working"}
