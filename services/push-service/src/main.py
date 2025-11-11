from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import aio_pika
import json
import asyncio
from typing import Optional
import logging
from datetime import datetime
import uuid
from redis import asyncio as aioredis
import httpx
from circuitbreaker import circuit
import os
from src.schemas import HealthResponse
import time
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from datetime import datetime, timezone
import base64

load_dotenv()


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


RABBITMQ_URL = os.getenv("RABBITMQ_URL")
REDIS_URL = os.getenv("REDIS_URL")


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


SERVICE_ACCOUNT_FILE_BASE64 = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if SERVICE_ACCOUNT_FILE_BASE64:
    SERVICE_ACCOUNT_FILE_JSON = base64.b64decode(SERVICE_ACCOUNT_FILE_BASE64).decode(
        "utf-8"
    )
    SERVICE_ACCOUNT_FILE = json.loads(SERVICE_ACCOUNT_FILE_JSON)


PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
FCM_V1_URL = f"https://fcm.googleapis.com/v1/projects/{PROJECT_ID}/messages:send"

SCOPES = ["https://www.googleapis.com/auth/firebase.messaging"]
credentials = service_account.Credentials.from_service_account_info(
    SERVICE_ACCOUNT_FILE, scopes=SCOPES
)


class ServiceState:
    rabbitmq_connection: Optional[aio_pika.Connection] = None
    rabbitmq_channel: Optional[aio_pika.Channel] = None
    redis_client: Optional[aioredis.Redis] = None
    push_queue: Optional[aio_pika.Queue] = None
    is_processing: bool = False
    retry_count: dict = {}
    circuit_breaker_open: bool = False


state = ServiceState()


async def get_access_token():
    """Generate OAuth2 access token for FCM v1 API"""
    if not credentials.valid or credentials.expired:
        credentials.refresh(Request())
    return credentials.token


@circuit(failure_threshold=5, recovery_timeout=60, expected_exception=Exception)
async def send_fcm_notification(
    push_token: str,
    title: str,
    body: str,
    image: Optional[str] = None,
    link: Optional[str] = None,
):
    """Send push notification via FCM with circuit breaker"""
    access_token = await get_access_token()

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    message = {
        "message": {
            "token": push_token,
            "notification": {"title": title, "body": body},
            "data": {"link": link or ""},
        }
    }

    if image:
        message["message"]["notification"]["image"] = image

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(FCM_V1_URL, json=message, headers=headers)
        response.raise_for_status()
        return response.json()


async def send_status_update(
    notification_id: str, status: str, error: Optional[str] = None
):
    """Send notification status update to status queue"""
    try:
        status_message = {
            "notification_id": notification_id,
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
            "error": error,
        }

        exchange = await state.rabbitmq_channel.declare_exchange(
            "notifications.direct", aio_pika.ExchangeType.DIRECT, durable=True
        )

        await exchange.publish(
            aio_pika.Message(
                body=json.dumps(status_message).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key="status.queue",
        )

        logger.info(f"Status update sent: {notification_id} - {status}")
    except Exception as e:
        logger.error(f"Failed to send status update: {e}")


async def process_push_notification(message_body: dict):
    """Process a single push notification"""
    notification_id = message_body.get("notification_id")
    request_id = message_body.get("request_id")

    try:

        cache_key = f"push:processed:{request_id}"
        if await state.redis_client.exists(cache_key):
            logger.info(f"Duplicate notification detected: {request_id}")
            return

        push_token = message_body.get("push_token")
        title = message_body.get("title")
        body = message_body.get("body")
        image = message_body.get("image")
        link = message_body.get("link")

        logger.info(f"Processing push notification: {notification_id}")

        await send_status_update(notification_id, "pending")
        result = await send_fcm_notification(push_token, title, body, image, link)

        await send_status_update(notification_id, "delivered")
        await state.redis_client.setex(cache_key, 3600, "1")

        logger.info(f"Push notification delivered: {notification_id}")

    except Exception as e:
        logger.error(f"Failed to process push notification {notification_id}: {e}")

        retry_key = f"push:retry:{notification_id}"
        retry_count = state.retry_count.get(notification_id, 0)

        if retry_count < 3:

            state.retry_count[notification_id] = retry_count + 1
            delay = 2**retry_count

            await asyncio.sleep(delay)
            logger.info(
                f"Retrying notification {notification_id} (attempt {retry_count + 1})"
            )

            exchange = await state.rabbitmq_channel.declare_exchange(
                "notifications.direct", aio_pika.ExchangeType.DIRECT, durable=True
            )

            await exchange.publish(
                aio_pika.Message(
                    body=json.dumps(message_body).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key="push.queue",
            )
        else:

            await send_status_update(notification_id, "failed", str(e))

            exchange = await state.rabbitmq_channel.declare_exchange(
                "notifications.direct", aio_pika.ExchangeType.DIRECT, durable=True
            )

            await exchange.publish(
                aio_pika.Message(
                    body=json.dumps(message_body).encode(),
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                ),
                routing_key="failed.queue",
            )

            logger.error(f"Notification moved to DLQ: {notification_id}")


async def consume_push_queue():
    """Consume messages from push queue"""
    async with state.push_queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                try:
                    message_body = json.loads(message.body.decode())
                    await process_push_notification(message_body)
                except Exception as e:
                    logger.error(f"Error processing message: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""

    try:

        state.rabbitmq_connection = await aio_pika.connect_robust(RABBITMQ_URL)
        state.rabbitmq_channel = await state.rabbitmq_connection.channel()
        await state.rabbitmq_channel.set_qos(prefetch_count=10)

        exchange = await state.rabbitmq_channel.declare_exchange(
            "notifications.direct", aio_pika.ExchangeType.DIRECT, durable=True
        )

        state.push_queue = await state.rabbitmq_channel.declare_queue(
            "push.queue", durable=True
        )

        await state.push_queue.bind(exchange, routing_key="push.queue")

        state.redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)

        logger.info("Push Service started successfully")

        state.is_processing = True
        asyncio.create_task(consume_push_queue())

    except Exception as e:
        logger.error(f"Failed to start Push Service: {e}")
        raise

    yield

    state.is_processing = False
    if state.rabbitmq_connection:
        await state.rabbitmq_connection.close()
    if state.redis_client:
        await state.redis_client.close()
    logger.info("Push Service shut down")


app = FastAPI(
    title="Push Notification Service",
    description="Microservice for handling push notifications",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        service="push-service",
        timestamp=datetime.now(timezone.utc).isoformat(),
        queue_connected=state.rabbitmq_connection is not None
        and not state.rabbitmq_connection.is_closed,
        redis_connected=state.redis_client is not None,
    )


@app.get("/metrics")
async def get_metrics():
    """Get service metrics"""
    try:

        declare_ok = await state.push_queue.declare()

        return {
            "success": True,
            "data": {
                "queue_length": declare_ok.message_count,
                "is_processing": state.is_processing,
                "active_retries": len(state.retry_count),
                "circuit_breaker_open": state.circuit_breaker_open,
            },
            "message": "Metrics retrieved successfully",
            "meta": None,
        }
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
