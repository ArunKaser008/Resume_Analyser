from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class ProofStatus(StrEnum):
    VERIFIED = "Verified"
    UNVERIFIED = "Unverified"
    HIGH_RISK = "High Risk of Misrepresentation"


class ProjectClaim(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    code_url: str | None = Field(default=None, max_length=2048)
    bullet_points: list[Annotated[str, Field(max_length=4000)]] = Field(
        default_factory=list,
        max_length=30,
    )


class ProofOfWorkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    github_url: str | None = Field(default=None, max_length=2048)
    leetcode_url: str | None = Field(default=None, max_length=2048)
    projects: list[ProjectClaim] = Field(default_factory=list, max_length=10)


class MonthlyActivity(BaseModel):
    month: str
    commits: int = Field(ge=0)


class GitHubStats(BaseModel):
    profile_url: str | None = None
    username: str | None = None
    valid: bool
    recent_commits: int = Field(ge=0)
    stars: int = Field(ge=0)
    top_languages: dict[str, int] = Field(default_factory=dict)
    monthly_activity: list[MonthlyActivity] = Field(default_factory=list)
    history_truncated: bool = False


class VerifiedProject(BaseModel):
    title: str
    status: ProofStatus
    repository_url: str | None = None
    repository_owner: str | None = None
    owner_matches_profile: bool | None = None
    is_fork: bool | None = None
    stars: int = Field(default=0, ge=0)
    commits_last_12_months: int = Field(default=0, ge=0)
    languages: list[str] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)


class LeetCodeStats(BaseModel):
    profile_url: str | None = None
    username: str | None = None
    valid: bool
    easy_solved: int = Field(default=0, ge=0)
    medium_solved: int = Field(default=0, ge=0)
    hard_solved: int = Field(default=0, ge=0)
    contest_rating: float | None = Field(default=None, ge=0)
    global_ranking: int | None = Field(default=None, ge=1)
    contests_attended: int = Field(default=0, ge=0)


class ProofOfWorkResponse(BaseModel):
    score: int = Field(ge=0, le=100)
    status: ProofStatus
    github: GitHubStats | None = None
    leetcode: LeetCodeStats | None = None
    projects: list[VerifiedProject] = Field(default_factory=list)
    summary: str
