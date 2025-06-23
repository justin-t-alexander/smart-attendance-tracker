from sqlalchemy import create_engine, Column, Integer, String, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./attendance.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



class registeredFaces(Base):
    __tablename__ = "registered_faces"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    encoding = Column(LargeBinary)  # Store face encoding as binary

class attendanceLog(Base):
    __tablename__ = "attendance_records"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    date = Column(String, index=True)  # Store date as string (e.g., "YYYY-MM-DD")
    time = Column(String, index=True)  # Store time as string (e.g., "HH:MM:SS")