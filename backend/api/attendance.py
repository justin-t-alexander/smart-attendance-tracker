from fastapi import APIRouter, HTTPException, UploadFile, File
import face_recognition
import numpy as np
import io


router = APIRouter()

@router.post("/check")
async def check_attendance(file: UploadFile = File(...)):
    """
    Check attendance by processing the uploaded image file.
    """
    if not file.filename.endswith(('.jpg', '.jpeg', '.png')):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JPG or PNG image.")

    try:
        # Read the image file
        contents = await file.read()
        image_stream = io.BytesIO(contents) 
        image = face_recognition.load_image_file(image_stream)

        # Process the image (e.g., detect faces, recognize faces, etc.)
        face_locations = face_recognition.face_locations(image)
        
        if not face_locations:
            raise HTTPException(status_code=404, detail="No faces found in the image.")

        # For demonstration, we just return the number of faces detected
        return {"message": f"Attendance checked. {len(face_locations)} face(s) detected."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/known_faces")
async def add_known_faces(file : UploadFile = File(...), name: str = None):
    """
    Add faces from the uploaded image file to the known faces database.
    """
   