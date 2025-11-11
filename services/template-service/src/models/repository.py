from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from src.models import Template
from src.schemas import TemplateCreate, TemplateUpdate
from typing import Optional, List, Tuple
import json
import logging

logger = logging.getLogger(__name__)


class TemplateRepository:
    """Repository for template database operations"""

    @staticmethod
    async def get_by_template_code(
        db: AsyncSession, template_code: str
    ) -> Optional[Template]:
        """Get template by template code (any version)"""
        result = await db.execute(
            select(Template).where(Template.template_code == template_code)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_template_code_and_language(
        db: AsyncSession, template_code: str, language: str
    ) -> Optional[Template]:
        """Get active template by code and language"""
        result = await db.execute(
            select(Template).where(
                Template.template_code == template_code,
                Template.language == language,
                Template.is_active == True,
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def create(
        db: AsyncSession, template_data: TemplateCreate, variables: List[str]
    ) -> Template:
        """Create a new template"""
        db_template = Template(
            template_code=template_data.template_code,
            name=template_data.name,
            notification_type=template_data.notification_type,
            language=template_data.language,
            subject=template_data.subject,
            body=template_data.body,
            title=template_data.title,
            variables=json.dumps(variables),
            created_by=template_data.created_by,
        )

        db.add(db_template)
        await db.commit()
        await db.refresh(db_template)

        logger.info(f"Template created in DB: {template_data.template_code}")
        return db_template

    @staticmethod
    async def list_templates(
        db: AsyncSession,
        page: int,
        limit: int,
        language: str,
        notification_type: Optional[str] = None,
    ) -> Tuple[List[Template], int]:
        """List templates with pagination"""
        query = select(Template).where(
            Template.language == language, Template.is_active == True
        )

        if notification_type:
            query = query.where(Template.notification_type == notification_type)

        # Count total
        count_result = await db.execute(
            select(func.count()).select_from(query.subquery())
        )
        total = count_result.scalar()

        # Paginate
        offset = (page - 1) * limit
        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        templates = result.scalars().all()

        return templates, total

    @staticmethod
    async def deactivate_template(db: AsyncSession, template: Template) -> None:
        """Deactivate a template"""
        template.is_active = False
        await db.commit()
        logger.info(
            f"Template deactivated: {template.template_code} v{template.version}"
        )

    @staticmethod
    async def create_new_version(
        db: AsyncSession, old_template: Template, update_data: TemplateUpdate
    ) -> Template:
        """Create a new version of an existing template"""
        new_template = Template(
            template_code=old_template.template_code,
            name=update_data.name or old_template.name,
            notification_type=old_template.notification_type,
            language=old_template.language,
            version=old_template.version + 1,
            subject=(
                update_data.subject
                if update_data.subject is not None
                else old_template.subject
            ),
            body=update_data.body or old_template.body,
            title=(
                update_data.title
                if update_data.title is not None
                else old_template.title
            ),
            variables=(
                json.dumps(update_data.variables)
                if update_data.variables
                else old_template.variables
            ),
        )

        db.add(new_template)
        await db.commit()
        await db.refresh(new_template)

        logger.info(
            f"New template version created: {new_template.template_code} v{new_template.version}"
        )
        return new_template

    @staticmethod
    async def get_template_data_dict(template: Template) -> dict:
        """Convert template model to dictionary"""
        return {
            "id": template.id,
            "template_code": template.template_code,
            "name": template.name,
            "notification_type": template.notification_type,
            "subject": template.subject,
            "body": template.body,
            "title": template.title,
            "variables": json.loads(template.variables),
            "version": template.version,
        }

    @staticmethod
    async def get_template_cache_dict(template: Template) -> dict:
        """Get template data for caching"""
        return {
            "subject": template.subject,
            "body": template.body,
            "title": template.title,
            "variables": json.loads(template.variables),
        }
