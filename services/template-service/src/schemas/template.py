from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any


class TemplateCreate(BaseModel):
    template_code: str
    name: str
    notification_type: str
    language: str = "en"
    subject: Optional[str] = None
    body: str
    title: Optional[str] = None
    variables: List[str]
    created_by: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    title: Optional[str] = None
    variables: Optional[List[str]] = None
    # is_active: Optional[bool] = None
    language: Optional[str] = None


class TemplateResponse(BaseModel):
    id: int
    template_code: str
    name: str
    notification_type: str
    language: str
    version: int
    subject: Optional[str]
    body: str
    title: Optional[str]
    variables: List[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RenderRequest(BaseModel):
    template_code: str
    variables: Dict[str, str]
    language: str = "en"


class RenderResponse(BaseModel):
    subject: Optional[str]
    body: str
    title: Optional[str]


class PaginationMeta(BaseModel):
    total: int
    limit: int
    page: int
    total_pages: int
    has_next: bool
    has_previous: bool


class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    message: str
    meta: Optional[PaginationMeta] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    database_connected: bool
    redis_connected: bool
