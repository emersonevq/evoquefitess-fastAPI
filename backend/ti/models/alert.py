from __future__ import annotations
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, LargeBinary, Boolean, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.db import Base

class Alert(Base):
    __tablename__ = "alert"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    severity = Column(Enum('low', 'medium', 'high', 'critical'), nullable=False, default='low')

    # Module/Page targeting - JSON list of page IDs from alert-pages.ts
    pages = Column(JSON, nullable=True, default=[])
    show_on_home = Column(Boolean, default=False, nullable=False)

    # Tracking
    created_by = Column(Integer, ForeignKey('user.id'), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)

    # Media
    imagem_blob = Column(LargeBinary, nullable=True)
    imagem_mime_type = Column(String(100), nullable=True)

    # Relationship to AlertView for tracking who has seen the alert
    views = relationship("AlertView", back_populates="alert", cascade="all, delete-orphan")


class AlertView(Base):
    __tablename__ = "alert_view"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey('alert.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    viewed_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationship
    alert = relationship("Alert", back_populates="views")
