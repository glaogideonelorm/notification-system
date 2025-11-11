"""
Tests for Push Service
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import json
from datetime import datetime


# Mock dependencies before importing main
@pytest.fixture(autouse=True)
def mock_dependencies():
    with patch("aio_pika.connect_robust", new_callable=AsyncMock), patch(
        "redis.asyncio.from_url", new_callable=AsyncMock
    ):
        yield


@pytest.fixture
def client():
    # Import after mocking
    import sys
    import os

    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

    from main import app

    return TestClient(app)


def test_health_check(client):
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "push-service"
    assert "timestamp" in data


def test_metrics_endpoint(client):
    """Test metrics endpoint"""
    with patch("main.state.push_queue") as mock_queue:
        mock_result = MagicMock()
        mock_result.declaration_result.message_count = 10
        mock_queue.declare = AsyncMock(return_value=mock_result)

        response = client.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data


@pytest.mark.asyncio
async def test_render_template_function():
    """Test template rendering"""
    from main import render_template

    template = "Hello {{name}}, your order {{order_id}} is ready!"
    variables = {"name": "John", "order_id": "12345"}

    result = render_template(template, variables)
    assert result == "Hello John, your order 12345 is ready!"


@pytest.mark.asyncio
async def test_send_fcm_notification():
    """Test FCM notification sending"""
    from main import send_fcm_notification

    with patch("httpx.AsyncClient") as mock_client:
        mock_response = MagicMock()
        mock_response.json.return_value = {"success": 1}
        mock_response.raise_for_status = MagicMock()

        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )

        result = await send_fcm_notification(
            push_token="test_token", title="Test", body="Test message"
        )

        assert result["success"] == 1


@pytest.mark.asyncio
async def test_process_push_notification():
    """Test push notification processing"""
    from main import process_push_notification, state

    # Mock dependencies
    state.redis_client = MagicMock()
    state.redis_client.exists = AsyncMock(return_value=False)
    state.redis_client.setex = AsyncMock()

    message_body = {
        "notification_id": "notif_123",
        "request_id": "req_123",
        "push_token": "test_token",
        "title": "Test",
        "body": "Test message",
        "image": None,
        "link": None,
    }

    with patch("main.send_fcm_notification", new_callable=AsyncMock) as mock_fcm, patch(
        "main.send_status_update", new_callable=AsyncMock
    ) as mock_status:

        mock_fcm.return_value = {"success": 1}

        await process_push_notification(message_body)

        # Verify FCM was called
        mock_fcm.assert_called_once()

        # Verify status updates were sent
        assert mock_status.call_count == 2  # pending and delivered


@pytest.mark.asyncio
async def test_idempotency():
    """Test idempotency check"""
    from main import process_push_notification, state

    state.redis_client = MagicMock()
    state.redis_client.exists = AsyncMock(return_value=True)  # Already processed

    message_body = {
        "notification_id": "notif_123",
        "request_id": "req_123",
        "push_token": "test_token",
        "title": "Test",
        "body": "Test message",
    }

    with patch("main.send_fcm_notification", new_callable=AsyncMock) as mock_fcm:
        await process_push_notification(message_body)

        # FCM should not be called for duplicate
        mock_fcm.assert_not_called()


@pytest.mark.asyncio
async def test_retry_logic():
    """Test retry logic on failure"""
    from main import process_push_notification, state

    state.redis_client = MagicMock()
    state.redis_client.exists = AsyncMock(return_value=False)
    state.retry_count = {}

    # Mock RabbitMQ channel
    mock_channel = MagicMock()
    mock_exchange = MagicMock()
    mock_exchange.publish = AsyncMock()
    mock_channel.declare_exchange = AsyncMock(return_value=mock_exchange)
    state.rabbitmq_channel = mock_channel

    message_body = {
        "notification_id": "notif_123",
        "request_id": "req_123",
        "push_token": "invalid_token",
        "title": "Test",
        "body": "Test message",
    }

    with patch("main.send_fcm_notification", new_callable=AsyncMock) as mock_fcm, patch(
        "asyncio.sleep", new_callable=AsyncMock
    ):

        mock_fcm.side_effect = Exception("FCM Error")

        await process_push_notification(message_body)

        # Check retry count was incremented
        assert "notif_123" in state.retry_count
        assert state.retry_count["notif_123"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
