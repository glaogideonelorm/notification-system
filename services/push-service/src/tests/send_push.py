import asyncio
import aio_pika
import json
import os
from dotenv import load_dotenv

load_dotenv()

RABBITMQ_URL = os.getenv("RABBITMQ_URL")


async def publish_messages(n=5):
    connection = await aio_pika.connect_robust(RABBITMQ_URL)
    channel = await connection.channel()
    exchange = await channel.declare_exchange(
        "notifications.direct", aio_pika.ExchangeType.DIRECT, durable=True
    )

    for i in range(1, n + 1):
        message_body = {
            "notification_id": f"test-{i}",
            "request_id": f"req-{i}",
            "push_token": "dummy-token",
            "title": f"Test Message {i}",
            "body": "This is a test",
            "image": None,
            "link": None,
        }
        await exchange.publish(
            aio_pika.Message(
                body=json.dumps(message_body).encode(),
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            ),
            routing_key="push.queue",
        )
        print(f"Published message {i}")

    await connection.close()


asyncio.run(publish_messages(n=10))
