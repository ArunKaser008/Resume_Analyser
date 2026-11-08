
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.resume_optimization_session import ResumeOptimizationSession
from app.models.resume_optimization_suggestion import ResumeOptimizationSuggestion


class ResumeOptimizationReviewRepository:

    @staticmethod
    def create_session(db: Session, session: ResumeOptimizationSession):
        db.add(session)
        db.flush()
        return session

    @staticmethod
    def create_suggestions(
        db: Session,
        suggestions: list[ResumeOptimizationSuggestion],
    ):
        db.add_all(suggestions)
        db.flush()
        return suggestions

    @staticmethod
    def get_session(db: Session, session_id: UUID):
        return (
            db.query(ResumeOptimizationSession)
            .filter(ResumeOptimizationSession.id == session_id)
            .first()
        )

    @staticmethod
    def get_sessions_by_resume(db: Session, resume_id: UUID):
        return (
            db.query(ResumeOptimizationSession)
            .filter(ResumeOptimizationSession.resume_id == resume_id)
            .order_by(ResumeOptimizationSession.created_at.desc())
            .all()
        )

    @staticmethod
    def get_suggestions(db: Session, session_id: UUID):
        return (
            db.query(ResumeOptimizationSuggestion)
            .filter(ResumeOptimizationSuggestion.session_id == session_id)
            .order_by(ResumeOptimizationSuggestion.created_at.asc())
            .all()
        )

    @staticmethod
    def get_suggestion(db: Session, suggestion_id: UUID):
        return (
            db.query(ResumeOptimizationSuggestion)
            .filter(ResumeOptimizationSuggestion.id == suggestion_id)
            .first()
        )

    @staticmethod
    def update_suggestion_status(
        db: Session,
        suggestion: ResumeOptimizationSuggestion,
        status: str,
    ):
        suggestion.status = status
        db.flush()
        return suggestion

    @staticmethod
    def commit(db: Session):
        db.commit()

    @staticmethod
    def rollback(db: Session):
        db.rollback()

    @staticmethod
    def get_session_for_update(db: Session, session_id: UUID):
        return (
            db.query(ResumeOptimizationSession)
            .filter(ResumeOptimizationSession.id == session_id)
            .with_for_update()
            .first()
        )
    
    @staticmethod
    def get_session_for_update(db: Session, session_id: UUID):
        return (
            db.query(ResumeOptimizationSession)
            .filter(ResumeOptimizationSession.id == session_id)
            .with_for_update()
            .first()
        )
