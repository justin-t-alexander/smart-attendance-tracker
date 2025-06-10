from sqlalchemy import Column, Integer, String, LargeBinary
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class KnownFace(Base):
    __tablename__ = "known_faces"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    encoding = Column(LargeBinary)  # Store face encoding as binary
