from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session
from typing import Optional
from jose import JWTError, jwt
import face_recognition
import numpy as np
import datetime
import io
import os

from models.database import (
    User,
    registeredFaces,
    attendanceLog,
    get_db,
)
from security import verify_password, create_access_token

router = APIRouter()


@router.post("/auth/login")
def login(data: dict, db: Session = Depends(get_db)):
    username = data.get("username")
    password = data.get("password")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username")

    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = create_access_token({"sub": str(user.id), "username": user.username})

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "name": user.name,
        "token": token
    }


@router.post("/check-faces")
async def check_attendance(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file type.")

    try:
        contents = await file.read()
        image = face_recognition.load_image_file(io.BytesIO(contents))
        face_locations = face_recognition.face_locations(image)

        if not face_locations:
            raise HTTPException(status_code=404, detail="No faces found.")

        face_encodings = face_recognition.face_encodings(image, face_locations)
        registered_faces = db.query(registeredFaces).all()
        recognized_names = []

        for encoding in face_encodings:
            for registered_face in registered_faces:
                known_encoding = np.frombuffer(registered_face.encoding, dtype=np.float64)
                match = face_recognition.compare_faces([known_encoding], encoding)[0]
                if match and registered_face.name not in recognized_names:
                    existing_entry = db.query(attendance_records).filter_by(
                        name=registered_face.name,
                        date=str(datetime.date.today())
                    ).first()
                    if not existing_entry:
                        db.add(attendance_records(
                            name=registered_face.name,
                            date=str(datetime.date.today()),
                            time=str(datetime.datetime.now().time())
                        ))
                        db.commit()
                    recognized_names.append(registered_face.name)
                    break

        return {"message": f"Attendance checked. {len(recognized_names)} person(s) logged."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/register-faces")
async def register_info(file: UploadFile = File(...), name: str = Form(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file type.")
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    try:
        contents = await file.read()
        image = face_recognition.load_image_file(io.BytesIO(contents))
        face_encodings = face_recognition.face_encodings(image)

        if not face_encodings:
            raise HTTPException(status_code=404, detail="No faces found.")

        encoding = face_encodings[0]
        new_face = registeredFaces(name=name, encoding=encoding.tobytes())

        db.add(new_face)
        db.commit()

        return {"message": f"Face registered successfully for {name}."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/log")
async def get_log(date: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        query = db.query(attendance_records)
        if date:
            query = query.filter(attendance_records.date == date)
        records = query.all()

        return {
            "records": [
                {"name": r.name, "date": r.date, "time": r.time} for r in records
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/reset-logs")
def reset_logs(db: Session = Depends(get_db)):
    db.query(attendance_records).delete()
    db.commit()
    return {"message": "Attendance logs cleared."}


@router.delete("/reset-faces")
def reset_faces(db: Session = Depends(get_db)):
    db.query(registeredFaces).delete()
    db.commit()
    return {"message": "Registered faces cleared."}
