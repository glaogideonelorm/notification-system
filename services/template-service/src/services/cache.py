from redis.asyncio import Redis
import json
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class CacheService:
    """Service for template caching operations"""

    def __init__(self, redis_client: Redis):
        self.redis_client = redis_client
        self.default_ttl = 3600  # 1 hour

    def _get_template_cache_key(self, template_code: str, language: str) -> str:
        """Generate cache key for template"""
        return f"template:{template_code}:{language}"

    async def get_template(self, template_code: str, language: str) -> Optional[Dict]:
        """Get template from cache"""
        try:
            cache_key = self._get_template_cache_key(template_code, language)
            cached = await self.redis_client.get(cache_key)

            if cached:
                logger.info(f"Cache hit for template: {template_code}")
                return json.loads(cached)

            logger.info(f"Cache miss for template: {template_code}")
            return None

        except Exception as e:
            logger.error(f"Error getting template from cache: {e}")
            return None

    async def set_template(
        self, template_code: str, language: str, template_data: Dict, ttl: int = None
    ) -> bool:
        """Cache template data"""
        try:
            cache_key = self._get_template_cache_key(template_code, language)
            ttl = ttl or self.default_ttl

            await self.redis_client.setex(cache_key, ttl, json.dumps(template_data))

            logger.info(f"Template cached: {template_code}")
            return True

        except Exception as e:
            logger.error(f"Error caching template: {e}")
            return False

    async def invalidate_template(
        self, template_code: str, language: str = None
    ) -> bool:
        """Invalidate template cache"""
        try:
            if language:
                # Invalidate specific language
                cache_key = self._get_template_cache_key(template_code, language)
                await self.redis_client.delete(cache_key)
                logger.info(f"Cache invalidated: {template_code}:{language}")
            else:
                # Invalidate all languages for this template
                pattern = f"template:{template_code}:*"
                cursor = 0
                deleted_count = 0

                while True:
                    cursor, keys = await self.redis_client.scan(
                        cursor, match=pattern, count=100
                    )
                    if keys:
                        await self.redis_client.delete(*keys)
                        deleted_count += len(keys)

                    if cursor == 0:
                        break

                logger.info(
                    f"Cache invalidated for template: {template_code} ({deleted_count} keys)"
                )

            return True

        except Exception as e:
            logger.error(f"Error invalidating cache: {e}")
            return False

    async def clear_all_templates(self) -> bool:
        """Clear all template caches (use with caution)"""
        try:
            pattern = "template:*"
            cursor = 0
            deleted_count = 0

            while True:
                cursor, keys = await self.redis_client.scan(
                    cursor, match=pattern, count=100
                )
                if keys:
                    await self.redis_client.delete(*keys)
                    deleted_count += len(keys)

                if cursor == 0:
                    break

            logger.info(f"All template caches cleared ({deleted_count} keys)")
            return True

        except Exception as e:
            logger.error(f"Error clearing all caches: {e}")
            return False
