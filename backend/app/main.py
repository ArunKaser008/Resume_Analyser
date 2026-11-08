
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.api.v1.career_profiles import router as career_profiles_router
from app.core.config import settings
from app.core.database import engine
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


app = FastAPI(
    title=settings.app_name,
    description="AI-powered resume analysis, creation and job matching platform.",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(career_profiles_router,prefix="/api/v1",)
app.include_router(resumes_router, prefix="/api/v1")
app.include_router(educations_router, prefix="/api/v1")
app.include_router(work_experiences_router, prefix="/api/v1")
app.include_router(technical_skills_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(certifications_router, prefix="/api/v1")
app.include_router(achievements_router, prefix="/api/v1")
app.include_router(resume_sections_router, prefix="/api/v1")
app.include_router(resume_preview_router, prefix="/api/v1")
app.include_router(resume_analysis_router, prefix="/api/v1")
app.include_router(resume_optimization_router,prefix="/api/v1",)

@app.get("/")
def root():
    return {
        "message": "MentorMuni Resume Intelligence API is running",
        "status": "success",
    }


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "resume-intelligence-api",
    }


@app.get("/api/v1/health/database")
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
        return {
            "status": "unhealthy",
            "database": "disconnected",
        }
