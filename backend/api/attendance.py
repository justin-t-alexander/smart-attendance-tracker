from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Body, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional
import face_recognition
import numpy as np
from datetime import datetime
import io
import base64
import cv2
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from models.database import (
    User,
    RegisteredFace,
    AttendanceLog,
    get_db,
)

from security import (
    verify_password,
    create_access_token,
    hash_password,
    get_current_user  # ⬅️ add this to extract user from token
)

router = APIRouter()




# ---------------------------
# Live attendance WebSocket with duplicate prevention
# ---------------------------

@router.websocket("/ws/live-attendance")
async def attendance_ws(websocket: WebSocket, db: Session = Depends(get_db)):
    # Accept connection immediately, no auth needed
    await websocket.accept()

    try:
        while True:
            # Receive frame from frontend
            data = await websocket.receive_text()
            if not data.startswith("data:image/jpeg;base64,"):
                continue  # ignore invalid data

            # Decode base64 → OpenCV image
            frame_bytes = base64.b64decode(data.split(",")[1])
            np_arr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            if frame is None:
                continue  # skip empty frames
                
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

            # Detect faces
            face_locations = face_recognition.face_locations(rgb_frame)
            face_encodings = face_recognition.face_encodings(rgb_frame, face_locations)

            results = []

            registered_faces = db.query(RegisteredFace).all()
            known_encodings = [np.frombuffer(f.encoding, dtype=np.float64) for f in registered_faces]

            for encoding in face_encodings:
                matches = face_recognition.compare_faces(known_encodings, encoding)
                if True in matches:
                    idx = matches.index(True)
                    face = registered_faces[idx]
                    name = face.name
                    user_id = face.user_id  # use user_id only

                    # Check for duplicate attendance today
                    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                    exists = db.query(AttendanceLog).filter(
                        AttendanceLog.user_id == user_id,
                        AttendanceLog.date >= today.strftime("%Y-%m-%d")
                    ).first()

                    if not exists:
                        now = datetime.now()
                        new_log = AttendanceLog(
                            name=name,
                            date=now.strftime("%Y-%m-%d"),
                            time=now.strftime("%H:%M:%S"),
                            user_id=user_id
                        )
                        db.add(new_log)
                        db.commit()

                    results.append({"name": name, "status": "present", "user_id": user_id})
                else:
                    results.append({"name": None, "status": "unknown", "user_id": None})

            await websocket.send_json(results)

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")


# ---------------------------
# User login endpoint
# ---------------------------

class LoginData(BaseModel):
    username: str
    password: str
@router.post("/api/login")
def login(data: LoginData, db: Session = Depends(get_db)):
    print("Received login data:", data)
    username = data.username
    password = data.password

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        print(f"Login failed for user: {username}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.id)
    print(f"Login success for user: {username}")

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
@router.post("/api/register-faces")
async def register_info(
    file: UploadFile = File(...),
    name: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.lower().endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file type.")
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    # Read file contents
    contents = await file.read()

    # Load image for face encoding
    image_np = face_recognition.load_image_file(io.BytesIO(contents))
    face_encodings = face_recognition.face_encodings(image_np)

    if not face_encodings:
        raise HTTPException(status_code=404, detail="No faces found.")

    encoding = face_encodings[0]

    new_face = RegisteredFace(
        name=name,
        encoding=encoding.tobytes(),   # for matching
        image_data=contents,                # for UI display
        user_id=current_user.id
    )

    db.add(new_face)
    db.commit()

    return {"message": f"Face registered successfully for {name}."}





# ---------------------------
# Get registered faces (user-specific)
# ---------------------------

from security import get_current_user  # make sure this is imported

@router.get("/api/registered-faces")
def get_registered_faces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # get logged-in user
):
    faces = (
        db.query(RegisteredFace)
        .filter(
            RegisteredFace.user_id == current_user.id,  # only this user's faces
            RegisteredFace.image_data != None,
            RegisteredFace.name != None
        )
        .all()
    )

    print(f"Found {len(faces)} faces for user {current_user.username}")

    return [
        {
            "id": face.id,
            "name": face.name,
            "image": base64.b64encode(face.image_data).decode("utf-8")
        }
        for face in faces
    ]

    




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
