from sqlalchemy import create_engine, Column, Integer, String, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import Boolean
from sqlalchemy import ForeignKey
from sqlalchemy.orm import relationship



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



class RegisteredFace(Base):
    __tablename__ = "registered_faces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    encoding = Column(LargeBinary)
    user_id = Column(Integer, ForeignKey("users.id"))  # Link to User table
    image_data = Column(LargeBinary)

    user = relationship("User", back_populates="faces")


class AttendanceLog(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    date = Column(String, index=True)
    time = Column(String, index=True)
    status = Column(String, default="present")
    user_id = Column(Integer, ForeignKey("users.id"))

    user = relationship("User", back_populates="logs")



class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)  # Store hashed version!

    faces = relationship("RegisteredFace", back_populates="user", cascade="all, delete")
    logs = relationship("AttendanceLog", back_populates="user", cascade="all, delete")

    







Base.metadata.create_all(bind=engine)

