
import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.core.database import engine

from app.api.v1.career_profiles import router as career_profiles_router
from app.api.v1.resumes import router as resumes_router
from app.api.v1.educations import router as educations_router
from app.api.v1.work_experiences import router as work_experiences_router
from app.api.v1.technical_skills import router as technical_skills_router
from app.api.v1.project import router as projects_router
from app.api.v1.certifications import router as certifications_router
from app.api.v1.achievements import router as achievements_router
from app.api.v1.resume_sections import router as resume_sections_router
from app.api.v1.resume_preview import router as resume_preview_router
from app.api.v1.resume_analysis import router as resume_analysis_router
from app.api.v1.resume_optimization import (
    router as resume_optimization_router,
)
from app.api.v1.resume_optimization_review import (
    router as resume_optimization_review_router,
)
from app.api.v1.resume_content_overrides import (
    router as resume_content_overrides_router,
)
from app.api.v1.job_description import router as job_description_router
from app.api.v1.candidate_jd_matching import (
    router as candidate_jd_matching_router,
)
from app.api.v1.resume_tailoring import router as resume_tailoring_router


logger = logging.getLogger(__name__)

API_PREFIX = "/api/v1"


app = FastAPI(
    title=settings.app_name,
    description=(
        "AI-powered resume analysis, optimization, creation "
        "and job matching platform."
    ),
    version="1.0.0",
)


@app.exception_handler(SQLAlchemyError)
async def handle_database_error(
    request: Request,
    exc: SQLAlchemyError,
) -> JSONResponse:
    logger.exception(
        "Database request failed for %s %s",
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": (
                "The database is unavailable. Verify PostgreSQL is running "
                "and the backend database settings are correct."
            )
        },
    )


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# API router registration
API_ROUTERS = [
    career_profiles_router,
    resumes_router,
    educations_router,
    work_experiences_router,
    technical_skills_router,
    projects_router,
    certifications_router,
    achievements_router,
    resume_sections_router,
    resume_preview_router,
    resume_analysis_router,
    resume_optimization_router,
    resume_optimization_review_router,
    resume_content_overrides_router,
    job_description_router,
    candidate_jd_matching_router,
    resume_tailoring_router,
]

for router in API_ROUTERS:
    app.include_router(
        router,
        prefix=API_PREFIX,
    )


# Root endpoint
@app.get("/", tags=["Health"])
def root():
    return {
        "message": "MentorMuni Resume Intelligence API is running",
        "status": "success",
        "version": app.version,
    }


# Application health check
@app.get(
    f"{API_PREFIX}/health",
    tags=["Health"],
)
def health_check():
    return {
        "status": "healthy",
        "service": "resume-intelligence-api",
    }


# Database health check
@app.get(
    f"{API_PREFIX}/health/database",
    tags=["Health"],
)
def database_health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "healthy",
            "database": "connected",
            "database_name": settings.db_name,
        }

    except SQLAlchemyError:
        logger.exception("Database health check failed.")

        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
            },
        )
