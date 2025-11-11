from typing import Optional, List, Dict
from redis import asyncio as aioredis


class ServiceState:
    engine = None
    async_session = None
    redis_client: Optional[aioredis.Redis] = None


state = ServiceState()
