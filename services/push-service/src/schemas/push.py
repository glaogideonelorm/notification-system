from pydantic import BaseModel, Field
from typing import Optional, Any, Dict
from datetime import datetime


class PushNotification(BaseModel):
    notification_id: str
    notification_type: str
    user_id: str
    push_token: str
    title: str
    body: str
    image: Optional[str] = None
    link: Optional[str] = None
    priority: int = 1
    metadata: Optional[dict] = None
    request_id: str
    template_code: str
    language: str
    variables: Dict[str, Any]
    user_email: str
    created_at: str
    retry_count: int = 0


class NotificationStatus(BaseModel):
    notification_id: str
    status: str
    timestamp: datetime
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    queue_connected: bool
    redis_connected: bool
