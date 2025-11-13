from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from datetime import datetime
import logging
from redis import asyncio as aioredis
from dotenv import load_dotenv
from urllib.parse import urlparse
from datetime import datetime, timezone

import os
from src.schemas import HealthResponse
from src.models import Base
from src.services import state
from src.routers import router
import asyncpg

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL and DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


REDIS_URL = os.getenv("REDIS_URL")

from urllib.parse import urlparse


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:

        state.engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True,)
        state.async_session = async_sessionmaker(
            state.engine, class_=AsyncSession, expire_on_commit=False
        )

        async with state.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        state.redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
        logger.info("Template Service started successfully")

    except Exception as e:
        logger.error(f"Failed to start Template Service: {e}")
        raise

    yield

    if state.engine:
        await state.engine.dispose()
    if state.redis_client:
        await state.redis_client.close()
    logger.info("Template Service shut down")


app = FastAPI(
    title="Template Service",
    description="Microservice for managing notification templates",
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

app.include_router(router)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    db_connected = False
    try:
        async with state.async_session() as session:
            await session.execute(select(1))
            db_connected = True
    except:
        pass

    return HealthResponse(
        status="healthy",
        service="template-service",
        timestamp=datetime.now(timezone.utc).isoformat(),
        database_connected=db_connected,
        redis_connected=state.redis_client is not None,
    )
