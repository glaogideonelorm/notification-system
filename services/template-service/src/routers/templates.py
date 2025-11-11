"""
Template Service Routes
Handles HTTP endpoints for template management
"""

from src.utils import extract_variables, render_template
from src.services import state
from src.models import TemplateRepository
from src.services import CacheService
from fastapi import HTTPException, Depends, APIRouter
from sqlalchemy.ext.asyncio import AsyncSession
from src.schemas import RenderRequest, TemplateCreate, TemplateUpdate
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize cache service
cache_service = None


def get_cache_service() -> CacheService:
    """Get cache service instance"""
    global cache_service
    if cache_service is None:
        cache_service = CacheService(state.redis_client)
    return cache_service


async def get_db():
    """Database session dependency"""
    async with state.async_session() as session:
        yield session


router = APIRouter(prefix="/api/v1", tags=["Templates"])


@router.post("/templates/", status_code=201)
async def create_template(
    template: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    cache: CacheService = Depends(get_cache_service),
):
    """Create a new template"""
    try:
        # Check if template code already exists
        existing = await TemplateRepository.get_by_template_code(
            db, template.template_code
        )
        if existing:
            raise HTTPException(status_code=400, detail="Template code already exists")

        # Auto-extract variables from template content
        auto_vars = extract_variables(template.body)
        if template.subject:
            auto_vars.extend(extract_variables(template.subject))
        if template.title:
            auto_vars.extend(extract_variables(template.title))

        all_vars = list(set(auto_vars + template.variables))

        # Create template in database
        db_template = await TemplateRepository.create(db, template, all_vars)

        # Cache the template
        cache_data = await TemplateRepository.get_template_cache_dict(db_template)
        await cache.set_template(template.template_code, template.language, cache_data)

        logger.info(f"Template created: {template.template_code}")

        return {
            "success": True,
            "data": {
                "id": db_template.id,
                "template_code": db_template.template_code,
                "version": db_template.version,
            },
            "message": "Template created successfully",
            "meta": None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{template_code}")
async def get_template(
    template_code: str,
    language: str = "en",
    db: AsyncSession = Depends(get_db),
    cache: CacheService = Depends(get_cache_service),
):
    """Get a template by code"""
    try:
        # Try cache first
        cached_data = await cache.get_template(template_code, language)
        if cached_data:
            return {
                "success": True,
                "data": cached_data,
                "message": "Template retrieved from cache",
                "meta": None,
            }

        # Query database if not in cache
        template = await TemplateRepository.get_by_template_code_and_language(
            db, template_code, language
        )

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # Prepare response data
        data = await TemplateRepository.get_template_data_dict(template)

        # Cache the result
        cache_data = await TemplateRepository.get_template_cache_dict(template)
        await cache.set_template(template_code, language, cache_data)

        return {
            "success": True,
            "data": data,
            "message": "Template retrieved successfully",
            "meta": None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/templates/render")
async def render_template_endpoint(
    request: RenderRequest,
    db: AsyncSession = Depends(get_db),
    cache: CacheService = Depends(get_cache_service),
):
    """Render a template with variables"""
    try:
        # Try to get template from cache
        template_data = await cache.get_template(
            request.template_code, request.language
        )

        # If not in cache, get from database
        if not template_data:
            template = await TemplateRepository.get_by_template_code_and_language(
                db, request.template_code, request.language
            )

            if not template:
                raise HTTPException(status_code=404, detail="Template not found")

            template_data = await TemplateRepository.get_template_cache_dict(template)

            # Cache for future use
            await cache.set_template(
                request.template_code, request.language, template_data
            )

        # Validate required variables
        required_vars = set(template_data["variables"])
        provided_vars = set(request.variables.keys())
        missing_vars = required_vars - provided_vars

        if missing_vars:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required variables: {', '.join(missing_vars)}",
            )

        # Render template parts
        rendered_body = render_template(template_data["body"], request.variables)
        rendered_subject = None
        rendered_title = None

        if template_data["subject"]:
            rendered_subject = render_template(
                template_data["subject"], request.variables
            )

        if template_data["title"]:
            rendered_title = render_template(template_data["title"], request.variables)

        return {
            "success": True,
            "data": {
                "subject": rendered_subject,
                "body": rendered_body,
                "title": rendered_title,
            },
            "message": "Template rendered successfully",
            "meta": None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to render template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/")
async def list_templates(
    page: int = 1,
    limit: int = 10,
    notification_type: Optional[str] = None,
    language: str = "en",
    db: AsyncSession = Depends(get_db),
):
    """List all templates with pagination"""
    try:
        # Get templates from repository
        templates, total = await TemplateRepository.list_templates(
            db, page, limit, language, notification_type
        )

        # Format response data
        data = [
            {
                "id": t.id,
                "template_code": t.template_code,
                "name": t.name,
                "notification_type": t.notification_type,
                "version": t.version,
            }
            for t in templates
        ]

        # Calculate pagination metadata
        total_pages = (total + limit - 1) // limit

        return {
            "success": True,
            "data": data,
            "message": "Templates retrieved successfully",
            "meta": {
                "total": total,
                "limit": limit,
                "page": page,
                "total_pages": total_pages,
                "has_next": page < total_pages,
                "has_previous": page > 1,
            },
        }

    except Exception as e:
        logger.error(f"Failed to list templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/templates/{template_code}")
async def update_template(
    template_code: str,
    update: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    cache: CacheService = Depends(get_cache_service),
):
    """Update a template (creates new version)"""
    try:
        # Get existing template
        template = await TemplateRepository.get_by_template_code(db, template_code)

        if not template:
            raise HTTPException(status_code=404, detail="Template not found")

        # Deactivate old version
        await TemplateRepository.deactivate_template(db, template)

        # Create new version
        new_template = await TemplateRepository.create_new_version(db, template, update)

        # Invalidate cache for all languages of this template
        await cache.invalidate_template(template_code)

        return {
            "success": True,
            "data": {"version": new_template.version},
            "message": "Template updated successfully",
            "meta": None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update template: {e}")
        raise HTTPException(status_code=500, detail=str(e))
