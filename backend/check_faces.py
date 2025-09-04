# check_faces.py
from models.database import SessionLocal, RegisteredFace



db = SessionLocal()

faces = db.query(RegisteredFace).all()

for face in faces:
    print(f"ID: {face.id}, Name: {face.name}, User ID: {face.user_id}, Encoding: {len(face.encoding) if face.encoding else 0} bytes, Image: {len(face.image_data) if face.image_data else 0} bytes")

db.close()
