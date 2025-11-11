from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, Integer, DateTime, Boolean, func
from datetime import datetime
from typing import Optional


class Base(DeclarativeBase):
    pass


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    template_code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    notification_type: Mapped[str] = mapped_column(String(50))
    language: Mapped[str] = mapped_column(String(10), default="en")
    version: Mapped[int] = mapped_column(Integer, default=1)

    # Template content
    subject: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )  # For email
    body: Mapped[str] = mapped_column(Text)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    # Metadata
    variables: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=func.now(), onupdate=func.now()
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
