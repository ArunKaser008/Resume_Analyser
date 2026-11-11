import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, urlparse

import httpx

from app.schemas.proof_of_work import (
    GitHubStats,
    LeetCodeStats,
    MonthlyActivity,
    ProofOfWorkRequest,
    ProofOfWorkResponse,
    ProofStatus,
    VerifiedProject,
)

GITHUB_API = "https://api.github.com"
LEETCODE_API = "https://leetcode.com/graphql"
GITHUB_URL_PATTERN = re.compile(
    r"https?://(?:www\.)?github\.com/[A-Za-z0-9-]+"
    r"(?:/[A-Za-z0-9_.-]+)?",
    re.IGNORECASE,
)
LEETCODE_URL_PATTERN = re.compile(
    r"https?://(?:www\.)?leetcode\.com/(?:u/)?[A-Za-z0-9_-]+/?",
    re.IGNORECASE,
)
LEETCODE_QUERY = """
query userPublicProfile($username: String!) {
  matchedUser(username: $username) {
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
  }
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
  }
}
"""


class ProofOfWorkProviderError(RuntimeError):
    """Raised when an external verification provider cannot return evidence."""


class ProofOfWorkRateLimitError(ProofOfWorkProviderError):
    """Raised when GitHub or LeetCode rejects requests due to rate limiting."""


def _url_username(url: str | None, allowed_host: str) -> str | None:
    if not url:
        return None
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in {
        allowed_host,
        f"www.{allowed_host}",
    }:
        return None
    path_parts = [part for part in parsed.path.split("/") if part]
    if allowed_host == "leetcode.com" and path_parts and path_parts[0] == "u":
        path_parts = path_parts[1:]
    if len(path_parts) != 1 or not re.fullmatch(r"[A-Za-z0-9_-]+", path_parts[0]):
        return None
    return path_parts[0]


def _github_repository(url: str | None) -> tuple[str, str] | None:
    if not url:
        return None
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in {
        "github.com",
        "www.github.com",
    }:
        return None
    parts = [part.removesuffix(".git") for part in parsed.path.split("/") if part]
    if len(parts) != 2 or not all(
        re.fullmatch(r"[A-Za-z0-9_.-]+", part) for part in parts
    ):
        return None
    return parts[0], parts[1]


def extract_profile_usernames(
    request: ProofOfWorkRequest,
) -> tuple[str | None, str | None]:
    github_url = request.github_url or ""
    leetcode_url = request.leetcode_url or ""
    for project in request.projects:
        source_text = " ".join(
            [project.code_url or "", *project.bullet_points]
        )
        if not github_url:
            match = GITHUB_URL_PATTERN.search(source_text)
            if match and _url_username(match.group(), "github.com"):
                github_url = match.group()
        if not leetcode_url:
            match = LEETCODE_URL_PATTERN.search(source_text)
            if match:
                leetcode_url = match.group()
    return (
        _url_username(github_url, "github.com"),
        _url_username(leetcode_url, "leetcode.com"),
    )


class ProofOfWorkService:
    @classmethod
    async def verify(
        cls,
        request: ProofOfWorkRequest,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> ProofOfWorkResponse:
        github_username, leetcode_username = extract_profile_usernames(request)
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(12.0),
                transport=transport,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "MentorMuni-ProofOfWork",
                },
            ) as client:
                github_stats, verified_projects = await cls._verify_github(
                    client,
                    github_username,
                    request,
                )
                leetcode_stats = (
                    await cls._verify_leetcode(client, leetcode_username)
                    if leetcode_username
                    else None
                )
        except ProofOfWorkProviderError:
            raise
        except (KeyError, TypeError, ValueError) as exc:
            raise ProofOfWorkProviderError(
                "A verification provider returned malformed public data."
            ) from exc

        score = calculate_proof_score(
            verified_projects,
            github_stats,
            leetcode_stats,
        )
        if any(project.status == ProofStatus.HIGH_RISK for project in verified_projects):
            status = ProofStatus.HIGH_RISK
            summary = "At least one claimed project has strong public evidence of being empty or fork-only."
        elif score >= 70 and (verified_projects or github_stats or leetcode_stats):
            status = ProofStatus.VERIFIED
            summary = "Available public evidence supports the submitted developer claims."
        else:
            status = ProofStatus.UNVERIFIED
            summary = (
                "Public evidence is insufficient to verify the submitted claims."
                if github_username or leetcode_username or request.projects
                else "Add GitHub or LeetCode profile links and project repository URLs to verify claims."
            )
        return ProofOfWorkResponse(
            score=score,
            status=status,
            github=github_stats,
            leetcode=leetcode_stats,
            projects=verified_projects,
            summary=summary,
        )

    @classmethod
    async def _verify_github(
        cls,
        client: httpx.AsyncClient,
        username: str | None,
        request: ProofOfWorkRequest,
    ) -> tuple[GitHubStats | None, list[VerifiedProject]]:
        github_stats: GitHubStats | None = None
        profile_valid = False
        if username:
            response = await cls._get(client, f"{GITHUB_API}/users/{quote(username)}")
            if response.status_code == 404:
                github_stats = GitHubStats(
                    profile_url=f"https://github.com/{username}",
                    username=username,
                    valid=False,
                    recent_commits=0,
                    stars=0,
                )
            else:
                profile = response.json()
                username = profile["login"]
                profile_valid = True
                github_stats = GitHubStats(
                    profile_url=f"https://github.com/{username}",
                    username=username,
                    valid=True,
                    recent_commits=0,
                    stars=0,
                    monthly_activity=_empty_months(),
                )

        has_repository_claim = any(
            _find_claim_repository(claim.code_url, claim.bullet_points)
            for claim in request.projects
        )
        if github_stats is None and has_repository_claim:
            github_stats = GitHubStats(
                valid=False,
                recent_commits=0,
                stars=0,
                monthly_activity=_empty_months(),
            )

        projects: list[VerifiedProject] = []
        monthly = Counter({item.month: 0 for item in _empty_months()})
        language_totals: Counter[str] = Counter()
        seen_repositories: set[tuple[str, str]] = set()
        for claim in request.projects:
            repository = _find_claim_repository(claim.code_url, claim.bullet_points)
            if repository is None:
                projects.append(
                    VerifiedProject(
                        title=claim.title,
                        status=ProofStatus.UNVERIFIED,
                        reasons=["No public GitHub repository URL was found in the project details."],
                    )
                )
                continue
            owner, name = repository
            repository_key = (owner.casefold(), name.casefold())
            repository_url = f"https://github.com/{owner}/{name}"
            if repository_key in seen_repositories:
                projects.append(
                    VerifiedProject(
                        title=claim.title,
                        status=ProofStatus.UNVERIFIED,
                        repository_url=repository_url,
                        reasons=["This repository URL is already linked to another project claim."],
                    )
                )
                continue
            seen_repositories.add(repository_key)
            response = await cls._get(
                client,
                f"{GITHUB_API}/repos/{quote(owner)}/{quote(name)}",
            )
            if response.status_code == 404:
                projects.append(
                    VerifiedProject(
                        title=claim.title,
                        status=ProofStatus.UNVERIFIED,
                        repository_url=repository_url,
                        reasons=["The repository is not publicly accessible; this does not prove the claim is false."],
                    )
                )
                continue

            repo = response.json()
            actual_owner = repo["owner"]["login"]
            is_fork = bool(repo.get("fork", False))
            stars = int(repo.get("stargazers_count", 0))
            languages_response = await cls._get(
                client,
                f"{GITHUB_API}/repos/{quote(owner)}/{quote(name)}/languages",
            )
            languages = languages_response.json()
            commit_count, activity, truncated = await cls._recent_commits(
                client,
                owner,
                name,
            )
            fork_only = False
            fork_comparison_available = not is_fork
            if is_fork and repo.get("parent"):
                parent = repo["parent"]
                base_branch = quote(parent.get("default_branch", "main"), safe="")
                head_branch = quote(repo.get("default_branch", "main"), safe="")
                comparison = await cls._get(
                    client,
                    f"{GITHUB_API}/repos/{quote(parent['owner']['login'])}/"
                    f"{quote(parent['name'])}/compare/{base_branch}..."
                    f"{quote(actual_owner)}:{head_branch}",
                )
                if comparison.status_code == 200:
                    fork_comparison_available = True
                    fork_only = int(comparison.json().get("ahead_by", 0)) == 0

            owner_matches = bool(username and actual_owner.casefold() == username.casefold())
            reasons: list[str] = []
            if int(repo.get("size", 0)) == 0:
                status = ProofStatus.HIGH_RISK
                reasons.append("The public repository contains no code.")
            elif fork_only:
                status = ProofStatus.HIGH_RISK
                reasons.append("The repository is a fork with no commits ahead of its source.")
            elif is_fork and not fork_comparison_available:
                status = ProofStatus.UNVERIFIED
                reasons.append("The fork could not be compared with its source repository.")
            elif not profile_valid:
                status = ProofStatus.UNVERIFIED
                reasons.append("A valid GitHub profile link is needed to verify repository ownership.")
            elif not owner_matches:
                status = ProofStatus.UNVERIFIED
                reasons.append("The repository owner does not match the submitted GitHub profile.")
            elif commit_count == 0:
                status = ProofStatus.UNVERIFIED
                reasons.append("No public commits were found in the last 12 months.")
            else:
                status = ProofStatus.VERIFIED
                reasons.append("Repository ownership and public commit activity match the submitted profile.")

            project_languages = sorted(languages)
            language_totals.update(languages)
            for month, count in activity.items():
                monthly[month] += count
            projects.append(
                VerifiedProject(
                    title=claim.title,
                    status=status,
                    repository_url=repository_url,
                    repository_owner=actual_owner,
                    owner_matches_profile=owner_matches,
                    is_fork=is_fork,
                    stars=stars,
                    commits_last_12_months=commit_count,
                    languages=project_languages,
                    reasons=reasons,
                )
            )
            if github_stats:
                github_stats.recent_commits += commit_count
                github_stats.stars += stars
                github_stats.history_truncated = (
                    github_stats.history_truncated or truncated
                )

        if github_stats:
            github_stats.top_languages = dict(
                language_totals.most_common(8)
            )
            github_stats.monthly_activity = [
                MonthlyActivity(month=month, commits=monthly[month])
                for month in monthly
            ]
        return github_stats, projects

    @classmethod
    async def _recent_commits(
        cls,
        client: httpx.AsyncClient,
        owner: str,
        repository: str,
    ) -> tuple[int, Counter[str], bool]:
        since = _twelve_months_ago().isoformat()
        counts: Counter[str] = Counter()
        total = 0
        truncated = False
        for page in range(1, 6):
            response = await cls._get(
                client,
                f"{GITHUB_API}/repos/{quote(owner)}/{quote(repository)}/commits",
                params={"since": since, "per_page": 100, "page": page},
            )
            if response.status_code == 409:
                break
            commits = response.json()
            for commit in commits:
                authored = (
                    commit.get("commit", {})
                    .get("author", {})
                    .get("date")
                )
                if authored:
                    date = datetime.fromisoformat(authored.replace("Z", "+00:00"))
                    counts[date.strftime("%Y-%m")] += 1
                total += 1
            if len(commits) < 100:
                break
            if page == 5:
                truncated = True
        return total, counts, truncated

    @classmethod
    async def _verify_leetcode(
        cls,
        client: httpx.AsyncClient,
        username: str,
    ) -> LeetCodeStats:
        try:
            response = await client.post(
                LEETCODE_API,
                json={
                    "query": LEETCODE_QUERY,
                    "variables": {"username": username},
                },
                headers={"Referer": "https://leetcode.com"},
            )
        except httpx.HTTPError as exc:
            raise ProofOfWorkProviderError(
                "LeetCode verification is temporarily unavailable."
            ) from exc
        _raise_for_provider_response(response, "LeetCode")
        payload = response.json()
        if payload.get("errors"):
            raise ProofOfWorkProviderError(
                "LeetCode did not return usable public profile data."
            )
        data = payload.get("data") or {}
        matched = data.get("matchedUser")
        if not matched:
            return LeetCodeStats(
                profile_url=f"https://leetcode.com/u/{username}/",
                username=username,
                valid=False,
            )
        counts = {
            entry["difficulty"]: int(entry["count"])
            for entry in matched.get("submitStatsGlobal", {}).get(
                "acSubmissionNum", []
            )
        }
        contest = data.get("userContestRanking") or {}
        rating = contest.get("rating")
        ranking = contest.get("globalRanking")
        return LeetCodeStats(
            profile_url=f"https://leetcode.com/u/{username}/",
            username=username,
            valid=True,
            easy_solved=counts.get("Easy", 0),
            medium_solved=counts.get("Medium", 0),
            hard_solved=counts.get("Hard", 0),
            contest_rating=float(rating) if rating is not None else None,
            global_ranking=int(ranking) if ranking else None,
            contests_attended=int(contest.get("attendedContestsCount") or 0),
        )

    @staticmethod
    async def _get(
        client: httpx.AsyncClient,
        url: str,
        *,
        params: dict[str, str | int] | None = None,
    ) -> httpx.Response:
        try:
            response = await client.get(url, params=params)
        except httpx.HTTPError as exc:
            raise ProofOfWorkProviderError(
                "GitHub verification is temporarily unavailable."
            ) from exc
        if response.status_code not in {404, 409}:
            _raise_for_provider_response(response, "GitHub")
        return response


def calculate_proof_score(
    projects: list[VerifiedProject],
    github: GitHubStats | None,
    leetcode: LeetCodeStats | None,
) -> int:
    """Score only available public signals and normalize their configured weights."""
    weighted_scores: list[tuple[float, float]] = []
    if projects:
        project_points = {
            ProofStatus.VERIFIED: 100,
            ProofStatus.UNVERIFIED: 35,
            ProofStatus.HIGH_RISK: 0,
        }
        weighted_scores.append(
            (
                0.60,
                sum(project_points[item.status] for item in projects) / len(projects),
            )
        )
    if github and github.valid:
        activity_score = min(
            100,
            min(github.recent_commits, 10) * 8
            + min(len(github.top_languages), 5) * 4
            + min(github.stars, 100) * 0.1,
        )
        weighted_scores.append((0.25, activity_score))
    if leetcode and leetcode.valid:
        solved_score = min(
            80,
            leetcode.easy_solved * 0.04
            + leetcode.medium_solved * 0.08
            + leetcode.hard_solved * 0.16,
        )
        rating_score = min(20, (leetcode.contest_rating or 0) / 150)
        weighted_scores.append((0.15, solved_score + rating_score))
    if not weighted_scores:
        return 0
    weight_total = sum(weight for weight, _ in weighted_scores)
    return round(
        sum(weight * score for weight, score in weighted_scores) / weight_total
    )


def _find_claim_repository(
    code_url: str | None,
    bullet_points: list[str],
) -> tuple[str, str] | None:
    candidates = [code_url or ""]
    candidates.extend(bullet_points)
    for candidate in candidates:
        match = GITHUB_URL_PATTERN.search(candidate)
        if match:
            repository = _github_repository(match.group())
            if repository:
                return repository
    return None


def _empty_months() -> list[MonthlyActivity]:
    now = datetime.now(timezone.utc)
    year, month = now.year, now.month
    for _ in range(11):
        month -= 1
        if month == 0:
            year -= 1
            month = 12
    result: list[MonthlyActivity] = []
    for _ in range(12):
        result.append(MonthlyActivity(month=f"{year:04d}-{month:02d}", commits=0))
        month += 1
        if month == 13:
            year += 1
            month = 1
    return result


def _twelve_months_ago() -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=365)


def _raise_for_provider_response(response: httpx.Response, provider: str) -> None:
    if response.status_code in {429, 403} and (
        response.status_code == 429
        or response.headers.get("X-RateLimit-Remaining") == "0"
    ):
        raise ProofOfWorkRateLimitError(
            f"{provider} API rate limit reached. Try again later."
        )
    if response.status_code >= 400:
        raise ProofOfWorkProviderError(
            f"{provider} verification failed with HTTP {response.status_code}."
        )
