import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import json
from datetime import datetime


@pytest.fixture(autouse=True)
def mock_dependencies():
    with patch("sqlalchemy.ext.asyncio.create_async_engine"), patch(
        "redis.asyncio.from_url", new_callable=AsyncMock
    ):
        yield


@pytest.fixture
def client():
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
    assert data["service"] == "template-service"


def test_render_template_function():
    """Test template rendering utility"""
    from main import render_template

    template = "Hello {{name}}, welcome to {{platform}}!"
    variables = {"name": "Alice", "platform": "NotifyHub"}

    result = render_template(template, variables)
    assert result == "Hello Alice, welcome to NotifyHub!"


def test_extract_variables_function():
    """Test variable extraction from template"""
    from main import extract_variables

    template = "Hello {{name}}, your order {{order_id}} is {{status}}!"
    variables = extract_variables(template)

    assert "name" in variables
    assert "order_id" in variables
    assert "status" in variables
    assert len(variables) == 3


def test_render_with_missing_variables():
    """Test rendering with missing variables"""
    from main import render_template

    template = "Hello {{name}}, order {{order_id}}"
    variables = {"name": "Bob"}  # Missing order_id

    result = render_template(template, variables)
    assert "Bob" in result
    assert "{{order_id}}" in result  # Unreplaced variable


@pytest.mark.asyncio
async def test_create_template():
    """Test template creation"""
    from main import app, get_db, state

    # Mock database session
    mock_session = MagicMock()
    mock_session.execute = AsyncMock(
        return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
    )
    mock_session.add = MagicMock()
    mock_session.commit = AsyncMock()
    mock_session.refresh = AsyncMock()

    # Mock Redis
    mock_redis = MagicMock()
    mock_redis.setex = AsyncMock()
    state.redis_client = mock_redis

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)

    template_data = {
        "template_code": "welcome_email",
        "name": "Welcome Email",
        "notification_type": "email",
        "language": "en",
        "subject": "Welcome {{name}}!",
        "body": "Hello {{name}}, welcome to our platform!",
        "variables": ["name"],
    }

    response = client.post("/api/v1/templates/", json=template_data)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True


@pytest.mark.asyncio
async def test_get_template():
    """Test retrieving a template"""
    from main import app, get_db, state, Template

    # Mock database result
    mock_template = Template(
        id=1,
        template_code="test_template",
        name="Test Template",
        notification_type="push",
        language="en",
        version=1,
        subject=None,
        body="Test {{message}}",
        title="Test Notification",
        variables=json.dumps(["message"]),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    mock_session = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_template
    mock_session.execute = AsyncMock(return_value=mock_result)

    # Mock Redis (cache miss)
    mock_redis = MagicMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.setex = AsyncMock()
    state.redis_client = mock_redis

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    response = client.get("/api/v1/templates/test_template?language=en")

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["template_code"] == "test_template"


@pytest.mark.asyncio
async def test_render_template_endpoint():
    """Test template rendering endpoint"""
    from main import app, get_db, state, Template

    mock_template = Template(
        id=1,
        template_code="order_notification",
        name="Order Notification",
        notification_type="push",
        language="en",
        version=1,
        subject=None,
        body="Your order {{order_id}} is {{status}}",
        title="Order Update",
        variables=json.dumps(["order_id", "status"]),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    mock_session = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_template
    mock_session.execute = AsyncMock(return_value=mock_result)

    # Mock Redis (cache miss)
    mock_redis = MagicMock()
    mock_redis.get = AsyncMock(return_value=None)
    state.redis_client = mock_redis

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)

    render_request = {
        "template_code": "order_notification",
        "variables": {"order_id": "12345", "status": "delivered"},
        "language": "en",
    }

    response = client.post("/api/v1/templates/render", json=render_request)

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "Your order 12345 is delivered" in data["data"]["body"]


@pytest.mark.asyncio
async def test_render_with_missing_variables():
    """Test rendering fails with missing variables"""
    from main import app, get_db, state, Template

    mock_template = Template(
        id=1,
        template_code="test",
        name="Test",
        notification_type="push",
        language="en",
        version=1,
        subject=None,
        body="Hello {{name}} {{surname}}",
        title="Test",
        variables=json.dumps(["name", "surname"]),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    mock_session = MagicMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_template
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_redis = MagicMock()
    mock_redis.get = AsyncMock(return_value=None)
    state.redis_client = mock_redis

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)

    render_request = {
        "template_code": "test",
        "variables": {"name": "John"},  # Missing surname
        "language": "en",
    }

    response = client.post("/api/v1/templates/render", json=render_request)
    assert response.status_code == 400
    assert "Missing required variables" in response.json()["detail"]


@pytest.mark.asyncio
async def test_template_caching():
    """Test that templates are cached in Redis"""
    from main import app, get_db, state, Template

    cached_data = json.dumps(
        {
            "subject": None,
            "body": "Cached {{message}}",
            "title": "Cached Title",
            "variables": ["message"],
        }
    )

    # Mock Redis (cache hit)
    mock_redis = MagicMock()
    mock_redis.get = AsyncMock(return_value=cached_data)
    state.redis_client = mock_redis

    mock_session = MagicMock()

    async def override_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = override_get_db

    client = TestClient(app)
    response = client.get("/api/v1/templates/cached_template?language=en")

    assert response.status_code == 200
    data = response.json()
    assert "from cache" in data["message"].lower()
    # Database should not be queried
    mock_session.execute.assert_not_called()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
