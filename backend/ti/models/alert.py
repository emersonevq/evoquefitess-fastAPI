from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, LargeBinary
from sqlalchemy.sql import func
from core.db import Base

class Alert(Base):
    __tablename__ = "alert"
    
    # APENAS OS CAMPOS QUE EXISTEM NO BANCO!
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(Enum('low', 'medium', 'high', 'critical'), nullable=False, default='low')
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    imagem_blob = Column(LargeBinary, nullable=True)
    imagem_mime_type = Column(String(100), nullable=True)
    message = Column(Text, nullable=True)