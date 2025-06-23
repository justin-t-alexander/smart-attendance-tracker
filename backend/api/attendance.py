from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
import face_recognition
import numpy as np
import io
from sqlalchemy.orm import Session
from models.database import registeredFaces
from models.database import get_db

router = APIRouter()

@router.post("/check")
async def check_attendance(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Check attendance by processing the uploaded image file.
    """
    if not file.filename.endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JPG or PNG image.")

    try:
        contents = await file.read()
        image_stream = io.BytesIO(contents) 
        image = face_recognition.load_image_file(image_stream)

        face_locations = face_recognition.face_locations(image)
        if not face_locations:
            raise HTTPException(status_code=404, detail="No faces found in the image.")

        face_encodings = face_recognition.face_encodings(image, face_locations)

        registered_faces = db.query(registeredFaces).all()
        recognized_names = []

        for encoding in face_encodings:
            for registered_face in registered_faces:
                known_encoding = np.frombuffer(registered_face.encoding, dtype=np.float64)
                match = face_recognition.compare_faces([known_encoding], encoding)[0]
                if match and registered_face.name not in recognized_names:
                    # Prevent duplicates
                    existing_entry = db.query(attendance_records).filter_by(
                        name=registered_face.name,
                        date=str(datetime.date.today())
                    ).first()
                    if not existing_entry:
                        log_entry = attendance_records(
                            name=registered_face.name,
                            date=str(datetime.date.today()),
                            time=str(datetime.datetime.now().time())
                        )
                        db.add(log_entry)
                        db.commit()
                    recognized_names.append(registered_face.name)
                    break

        return {"message": f"Attendance checked. {len(recognized_names)} person(s) logged."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/register")
async def registerInfo(file : UploadFile = File(...), name: str = Form(...), db: Session = Depends(get_db)):
    """
    Add face name pairs from the uploaded image file to the known faces database.
    """


    if not file.filename.endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JPG or PNG image.")

    if name.strip() == "":
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    try:
     # Read the image file
        contents = await file.read()
        image_stream = io.BytesIO(contents) 
        image = face_recognition.load_image_file(image_stream)

        # Process the image (e.g., detect faces, recognize faces, etc.)
        face_encodings = face_recognition.face_encodings(image)
        
        if not face_encodings:
            raise HTTPException(status_code=404, detail="No faces found in the image.")

        encoding = face_encodings[0]

        # Convert encoding to bytes
        encoding_bytes = encoding.tobytes()

        # Create a new registeredFaces instance
        new_face = registeredFaces(name=name, encoding=encoding_bytes)
        # Add to the database session
        db.add(new_face)
        db.commit()

        return {"message": f"Face registered successfully for {name}."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




#return logs of attendance
@router.get("/log")
async def get_log(db: Session = Depends(get_db)):


    """
    Retrieve the attendance log from the database.
    """
    try:
        records = db.query(attendanceLog).all()
        return {"records": [{"name": record.name, "date": record.date,
         "time": record.time} for record in records]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


    


  


