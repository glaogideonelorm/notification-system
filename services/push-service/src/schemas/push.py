from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PushNotification(BaseModel):
    notification_id: str
    user_id: str
    push_token: str
    title: str
    body: str
    image: Optional[str] = None
    link: Optional[str] = None
    priority: int = 1
    metadata: Optional[dict] = None
    request_id: str


class NotificationStatus(BaseModel):
    notification_id: str
    status: str
    timestamp: datetime
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime
    queue_connected: bool
    redis_connected: bool
