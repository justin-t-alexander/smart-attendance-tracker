from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Body, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import Optional
import face_recognition
import numpy as np
from datetime import datetime
import io
import base64
import cv2
import asyncio
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from PIL import Image
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIC_SUPPORT = True
except ImportError:
    HEIC_SUPPORT = False

from models.database import (
    User,
    RegisteredFace,
    AttendanceLog,
    get_db,
    SessionLocal,
)

from security import (
    verify_password,
    create_access_token,
    hash_password,
    get_current_user  # ⬅️ add this to extract user from token
)

from core.face_utils import FaceProcessor

router = APIRouter()




# ---------------------------
# Live attendance WebSocket with duplicate prevention
# ---------------------------

@router.websocket("/ws/live-attendance")
async def attendance_ws(websocket: WebSocket):
    # Accept connection immediately, no auth needed
    await websocket.accept()
    db = None
    frame_count = 0
    # Rolling buffer of recent encodings per face slot for averaging
    encoding_buffer = []
    BUFFER_SIZE = 5  # average over last 5 frames for stable matching

    try:
        db = SessionLocal()
        print("WebSocket connection established")

        while True:
            # Receive frame from frontend
            try:
                data = await websocket.receive_text()
            except (WebSocketDisconnect, RuntimeError):
                print(f"Client disconnected after {frame_count} frames")
                break

            try:
                if not data.startswith("data:image/jpeg;base64,"):
                    continue  # ignore invalid data

                frame_count += 1

                # Decode base64 → OpenCV image
                frame_bytes = base64.b64decode(data.split(",")[1])
                np_arr = np.frombuffer(frame_bytes, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if frame is None:
                    continue  # skip empty frames

                gray_check = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                avg_brightness = np.mean(gray_check)

                # Skip pitch-black frames (covered camera or lights off)
                if avg_brightness < 15:
                    await websocket.send_json([])
                    continue

                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                loop = asyncio.get_event_loop()

                # YuNet DNN detection - far superior to Haar/HOG at distance and angles
                face_locations = await loop.run_in_executor(
                    None,
                    lambda: FaceProcessor.detect_faces_yunet(rgb_frame)
                )

                face_locations = FaceProcessor.filter_faces_by_size(face_locations, min_face_size=20)
                print(f"Frame {frame_count}: brightness={avg_brightness:.0f}, faces={len(face_locations)}")

                # Clear buffer when face is lost so stale encodings don't pollute future matches
                if not face_locations:
                    encoding_buffer.clear()
                    await websocket.send_json([])
                    continue

                face_encodings = await loop.run_in_executor(
                    None,
                    lambda: face_recognition.face_encodings(rgb_frame, face_locations, num_jitters=1, model="large")
                )

                if not face_encodings:
                    await websocket.send_json([])
                    continue

                results = []

                registered_faces = db.query(RegisteredFace).all()
                known_encodings = [np.frombuffer(f.encoding, dtype=np.float64) for f in registered_faces]

                # Only buffer encodings that are a plausible match (< 0.7 distance)
                # Prevents bad frames (side angle, dark, noise) from polluting the average
                if known_encodings:
                    dist = np.min(face_recognition.face_distance(known_encodings, face_encodings[0]))
                    if dist < 0.7:
                        encoding_buffer.append(face_encodings[0])
                        if len(encoding_buffer) > BUFFER_SIZE:
                            encoding_buffer.pop(0)
                else:
                    encoding_buffer.append(face_encodings[0])
                    if len(encoding_buffer) > BUFFER_SIZE:
                        encoding_buffer.pop(0)

                averaged_encoding = np.mean(encoding_buffer, axis=0) if len(encoding_buffer) >= 3 else face_encodings[0]
                averaged_encodings = [averaged_encoding]

                for encoding in averaged_encodings:
                    is_match, confidence = FaceProcessor.compare_faces_with_distance(known_encodings, encoding, distance_threshold=0.5)

                    if face_locations and not face_encodings:
                        # Face detected but encoding failed (edge case)
                        results.append({"name": None, "status": "unknown", "confidence": 0})

                    if is_match:
                        distances = face_recognition.face_distance(known_encodings, encoding)
                        idx = np.argmin(distances)
                        face = registered_faces[idx]
                        name = face.name
                        user_id = face.user_id

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

                        results.append({
                            "name": name,
                            "status": "present",
                            "user_id": user_id,
                            "confidence": round(confidence, 3)
                        })
                    else:
                        results.append({
                            "name": None,
                            "status": "unknown",
                            "user_id": None,
                            "confidence": round(1.0 - np.min(face_recognition.face_distance(known_encodings, encoding)) if known_encodings else 0, 3)
                        })

                await websocket.send_json(results)

            except Exception as e:
                # Send keepalive on error to keep connection alive
                try:
                    await websocket.send_json({"status": "processing"})
                except:
                    pass
                print(f"⚠️ Frame {frame_count} error (skipping): {type(e).__name__}: {str(e)[:100]}")
                # Skip this frame and continue to next one
                continue

    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
        try:
            await websocket.close(code=1011, reason=str(e))
        except:
            pass
    finally:
        if db:
            db.close()


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
    allowed_types = ('.jpg', '.jpeg', '.png', '.heic', '.heif')
    if not file.filename.lower().endswith(allowed_types):
        raise HTTPException(status_code=400, detail="Invalid file type. Accepted: JPG, PNG, HEIC")
    if not name.strip():
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    # Read file contents
    file_contents = await file.read()

    # Convert HEIC to JPEG if needed
    if file.filename.lower().endswith(('.heic', '.heif')):
        if not HEIC_SUPPORT:
            raise HTTPException(status_code=400, detail="HEIC support not installed. Please use JPG or PNG.")
        try:
            img = Image.open(io.BytesIO(file_contents))
            # Convert to RGB (in case of RGBA)
            if img.mode in ('RGBA', 'LA', 'P'):
                rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = rgb_img
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            # Convert to JPEG bytes
            jpeg_buffer = io.BytesIO()
            img.save(jpeg_buffer, format='JPEG', quality=95)
            jpeg_buffer.seek(0)  # Reset buffer position
            contents = jpeg_buffer.getvalue()
            print(f"✓ Converted HEIC to JPEG: {len(contents)} bytes")
        except Exception as e:
            print(f"✗ HEIC conversion error: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to convert HEIC: {str(e)}")
    else:
        contents = file_contents

    # Load image for face encoding
    try:
        image_np = face_recognition.load_image_file(io.BytesIO(contents))
        print(f"✓ Image loaded: {image_np.shape}")

        # Downscale if image is too large (for performance)
        h, w = image_np.shape[:2]
        max_size = 1200
        if max(h, w) > max_size:
            scale = max_size / max(h, w)
            new_w, new_h = int(w * scale), int(h * scale)
            image_np = cv2.resize(image_np, (new_w, new_h))
            print(f"↓ Downscaled to: {image_np.shape}")
    except Exception as e:
        print(f"✗ Image load error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to load image: {str(e)}")

    # Preprocess image for consistency with live detection
    image_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
    enhanced_image = FaceProcessor.preprocess_image(image_bgr)
    image_np = cv2.cvtColor(enhanced_image, cv2.COLOR_BGR2RGB)

    # Detect faces using same method as live detection (CNN + upsampling for consistency)
    print(f"🔍 Starting face detection...")
    try:
        print(f"📊 Image shape before detection: {image_np.shape}")
        face_locations = FaceProcessor.detect_faces_with_upsampling(image_np, use_cnn=True, upsample_num_times=1)
        print(f"✓ Faces detected: {len(face_locations)}")
        if not face_locations:
            print("⚠️ No faces found in image")
            raise HTTPException(status_code=404, detail="No faces found.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"✗ Face detection error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Face detection failed: {str(e)}")

    # Get encoding with high accuracy (12 jitters for registration - highest quality)
    # Using more jitters than live detection ensures registration is more robust
    face_encodings = FaceProcessor.get_face_encodings(image_np, face_locations, num_jitters=12)

    if not face_encodings:
        raise HTTPException(status_code=404, detail="Could not process face. Please try again.")

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
    registered_faces = db.query(RegisteredFace).filter_by(user_id=current_user.id).all()
    recognized_names = []

    for encoding in face_encodings:
        for registered_face in registered_faces:
            known_encoding = np.frombuffer(registered_face.encoding, dtype=np.float64)
            match = face_recognition.compare_faces([known_encoding], encoding)[0]
            if match and registered_face.name not in recognized_names:
                existing_entry = db.query(AttendanceLog).filter_by(
                    name=registered_face.name,
                    date=str(datetime.date.today()),
                    user_id=current_user.id  # ⬅️ filter per user
                ).first()
                if not existing_entry:
                    db.add(AttendanceLog(
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
    query = db.query(AttendanceLog).filter_by(user_id=current_user.id)
    if date:
        query = query.filter(AttendanceLog.date == date)

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
    db.query(AttendanceLog).filter_by(user_id=current_user.id).delete()
    db.commit()
    return {"message": "Your attendance logs have been cleared."}


@router.delete("/reset-faces")
def reset_faces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(RegisteredFace).filter_by(user_id=current_user.id).delete()
    db.commit()
    return {"message": "Your registered faces have been cleared."}
