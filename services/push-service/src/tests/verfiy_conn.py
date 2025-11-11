"""
Quick script to verify RabbitMQ and Redis connections before running tests
Run this with: python verify_connections.py
"""

import asyncio
import aio_pika
from redis import asyncio as aioredis
import os
from dotenv import load_dotenv

load_dotenv()

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://myuser:mypassword@localhost:5672/")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")


async def verify_rabbitmq():
    """Verify RabbitMQ connection"""
    try:
        print(f"🔍 Testing RabbitMQ connection: {RABBITMQ_URL}")
        connection = await aio_pika.connect_robust(RABBITMQ_URL)
        channel = await connection.channel()
        print("✅ RabbitMQ connection successful!")
        await channel.close()
        await connection.close()
        return True
    except Exception as e:
        print(f"❌ RabbitMQ connection failed: {e}")
        return False


async def verify_redis():
    """Verify Redis connection"""
    try:
        print(f"🔍 Testing Redis connection: {REDIS_URL}")
        redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
        await redis_client.set("test_key", "test_value")
        value = await redis_client.get("test_key")
        await redis_client.delete("test_key")
        assert value == "test_value"
        await redis_client.close()
        print("✅ Redis connection successful!")
        return True
    except Exception as e:
        print(f"❌ Redis connection failed: {e}")
        return False


async def main():
    print("\n" + "=" * 60)
    print("  Connection Verification for Integration Tests")
    print("=" * 60 + "\n")

    rabbitmq_ok = await verify_rabbitmq()
    print()
    redis_ok = await verify_redis()
    print("\n" + "-" * 60)

    if rabbitmq_ok and redis_ok:
        print("🎉 All connections are healthy! You can run your tests safely.")
    else:
        print("⚠️ Some connections failed. Check the logs above before running tests.")
    print("-" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
