from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from sqlalchemy.orm import Session
from typing import Optional
import face_recognition
import numpy as np
import datetime
import io

from models.database import (
    User,
    RegisteredFace,
    AttendanceLog,
    get_db,
)
from security import (
    verify_password,
    create_access_token,
    get_current_user  # ⬅️ add this to extract user from token
)

router = APIRouter()


# ---------------------------
# User login endpoint
# ---------------------------
@router.post("/api/login")
def login(data: dict, db: Session = Depends(get_db)):
    username = data.get("username")
    password = data.get("password")

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.id)

    return {
        "id": user.id,
        "username": user.username,
        "token": token
    }


# ---------------------------
# Get current user from JWT
# ---------------------------
@router.get("/auth/user")
def get_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
    }


# ---------------------------
# Register new face
# ---------------------------
@router.post("/register-faces")
async def register_info(
    file: UploadFile = File(...),
    name: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file type.")
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    contents = await file.read()
    image = face_recognition.load_image_file(io.BytesIO(contents))
    face_encodings = face_recognition.face_encodings(image)

    if not face_encodings:
        raise HTTPException(status_code=404, detail="No faces found.")

    encoding = face_encodings[0]
    new_face = RegisteredFace(
        name=name,
        encoding=encoding.tobytes(),
        user_id=current_user.id  # ⬅️ tie to user
    )

    db.add(new_face)
    db.commit()

    return {"message": f"Face registered successfully for {name}."}


# ---------------------------
# Check attendance
# ---------------------------
@router.post("/check-faces")
async def check_attendance(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file type.")

    contents = await file.read()
    image = face_recognition.load_image_file(io.BytesIO(contents))
    face_locations = face_recognition.face_locations(image)

    if not face_locations:
        raise HTTPException(status_code=404, detail="No faces found.")

    face_encodings = face_recognition.face_encodings(image, face_locations)
    registered_faces = db.query(registeredFaces).filter_by(user_id=current_user.id).all()
    recognized_names = []

    for encoding in face_encodings:
        for registered_face in registered_faces:
            known_encoding = np.frombuffer(registered_face.encoding, dtype=np.float64)
            match = face_recognition.compare_faces([known_encoding], encoding)[0]
            if match and registered_face.name not in recognized_names:
                existing_entry = db.query(attendanceLog).filter_by(
                    name=registered_face.name,
                    date=str(datetime.date.today()),
                    user_id=current_user.id  # ⬅️ filter per user
                ).first()
                if not existing_entry:
                    db.add(attendanceLog(
                        name=registered_face.name,
                        date=str(datetime.date.today()),
                        time=str(datetime.datetime.now().time()),
                        user_id=current_user.id  # ⬅️ tie to user
                    ))
                    db.commit()
                recognized_names.append(registered_face.name)
                break

    return {"message": f"Attendance checked. {len(recognized_names)} person(s) logged."}


# ---------------------------
# Get attendance log
# ---------------------------
@router.get("/log")
async def get_log(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(attendanceLog).filter_by(user_id=current_user.id)
    if date:
        query = query.filter(attendanceLog.date == date)

    records = query.all()

    return {
        "records": [
            {"name": r.name, "date": r.date, "time": r.time} for r in records
        ]
    }


# ---------------------------
# Reset endpoints
# ---------------------------
@router.delete("/reset-logs")
def reset_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(attendanceLog).filter_by(user_id=current_user.id).delete()
    db.commit()
    return {"message": "Your attendance logs have been cleared."}


@router.delete("/reset-faces")
def reset_faces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(registeredFaces).filter_by(user_id=current_user.id).delete()
    db.commit()
    return {"message": "Your registered faces have been cleared."}
