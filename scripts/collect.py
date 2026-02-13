#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = ["requests"]
# ///
"""Collect open-source contribution data from GitHub repos and rank universities."""

import json
import os
import subprocess
from collections import defaultdict
from pathlib import Path

import requests

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
DATA_DIR = ROOT_DIR / "data"
REPOS_FILE = DATA_DIR / "repos.txt"
UNIVERSITIES_FILE = DATA_DIR / "universities.json"
ALIASES_FILE = DATA_DIR / "aliases.json"
OUTPUT_FILE = ROOT_DIR / "site" / "public" / "rankings.json"
CACHE_DIR = ROOT_DIR / ".cache" / "repos"

GITHUB_API = "https://api.github.com"


def load_repos() -> list[str]:
    lines = REPOS_FILE.read_text().strip().splitlines()
    return [l.strip() for l in lines if l.strip() and not l.startswith("#")]


def load_university_map() -> dict[str, str]:
    return json.loads(UNIVERSITIES_FILE.read_text())


def load_aliases() -> dict[str, str]:
    """Load email -> .edu domain aliases."""
    try:
        data = json.loads(ALIASES_FILE.read_text())
        return {k.lower(): v.lower() for k, v in data.get("aliases", {}).items()}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def extract_edu_domain(email: str) -> str | None:
    """Extract the .edu domain from an email address."""
    email = email.lower().strip()
    if "@" not in email:
        return None
    _, _, domain = email.partition("@")
    if not domain or "@" in domain:
        return None
    if not (domain.endswith(".edu") or domain.endswith(".ac.uk")
            or domain.endswith(".ethz.ch") or domain.endswith(".epfl.ch")
            or domain.endswith(".utoronto.ca")):
        return None
    return domain


def normalize_domain(domain: str, uni_map: dict[str, str]) -> str:
    """Normalize to the shortest (root) university domain that matches."""
    parts = domain.split(".")
    # Walk from root upward to find the shortest matching domain
    # e.g. for eecs.berkeley.edu, check berkeley.edu before eecs.berkeley.edu
    for i in range(len(parts) - 1, 0, -1):
        candidate = ".".join(parts[i:])
        if candidate in uni_map:
            return candidate
    # Fall back to direct match or return as-is
    return domain


def resolve_email(email: str, aliases: dict[str, str]) -> str | None:
    """Resolve an email to a .edu domain, checking aliases first."""
    email = email.lower().strip()
    # Check aliases first
    if email in aliases:
        return aliases[email]
    return extract_edu_domain(email)


def get_commit_emails_with_order(repo_dir: str) -> list[str]:
    """Get emails in chronological commit order (oldest first)."""
    result = subprocess.run(
        ["git", "log", "--first-parent", "--reverse", "--format=%ae"],
        cwd=repo_dir,
        capture_output=True,
        text=True,
    )
    return [line.lower().strip() for line in result.stdout.strip().splitlines() if line.strip()]


def fetch_star_count(owner: str, repo: str) -> int:
    """Fetch star count from GitHub API."""
    token = os.environ.get("GITHUB_TOKEN")
    headers = {}
    if token:
        headers["Authorization"] = f"token {token}"
    url = f"{GITHUB_API}/repos/{owner}/{repo}"
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        return resp.json().get("stargazers_count", 0)
    except Exception as e:
        print(f"  Warning: could not fetch stars for {owner}/{repo}: {e}")
        return 0


def clone_or_fetch_repo(repo_slug: str) -> str | None:
    """Clone a repo into the cache, or fetch updates if already cached. Returns repo dir or None."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    repo_dir = CACHE_DIR / repo_slug.replace("/", "_")
    url = f"https://github.com/{repo_slug}.git"

    if (repo_dir / "HEAD").exists():
        # Already cached — fetch updates
        print(f"  Fetching updates...")
        result = subprocess.run(
            ["git", "fetch", "origin"],
            cwd=repo_dir,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"  Warning: fetch failed, using cached data: {result.stderr.strip()}")
    else:
        # Fresh clone
        print(f"  Cloning...")
        result = subprocess.run(
            ["git", "clone", "--bare", "--single-branch", url, str(repo_dir)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print(f"  Error cloning {repo_slug}: {result.stderr.strip()}")
            return None

    return str(repo_dir)


def main():
    repos = load_repos()
    uni_map = load_university_map()
    aliases = load_aliases()

    print(f"Processing {len(repos)} repos...")
    if aliases:
        print(f"Loaded {len(aliases)} email aliases")

    # uni_domain -> {repo_slug -> weighted_score}
    uni_repo_weighted: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    # uni_domain -> {repo_slug -> raw_commit_count}
    uni_repo_commits: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    repo_stars: dict[str, int] = {}

    for i, repo_slug in enumerate(repos, 1):
        owner, repo = repo_slug.split("/", 1)
        print(f"[{i}/{len(repos)}] {repo_slug}")

        # Clone or fetch
        repo_dir = clone_or_fetch_repo(repo_slug)
        if repo_dir is None:
            continue

        # Get stars
        stars = fetch_star_count(owner, repo)
        repo_stars[repo_slug] = stars
        print(f"  Stars: {stars:,}")

        # Get commits in chronological order
        emails = get_commit_emails_with_order(repo_dir)
        total_commits = len(emails)
        if total_commits == 0:
            print("  No commits found")
            continue

        # Linear decay: commit #0 (oldest) gets weight 1.0,
        # commit #(N-1) (newest) gets weight 1/N.
        # Weight for commit at position k = (N - k) / N
        edu_count = 0
        for k, email in enumerate(emails):
            domain = resolve_email(email, aliases)
            if domain is None:
                continue
            domain = normalize_domain(domain, uni_map)
            weight = (total_commits - k) / total_commits
            uni_repo_weighted[domain][repo_slug] += weight
            uni_repo_commits[domain][repo_slug] += 1
            edu_count += 1

        print(f"  Found {edu_count} .edu commits (of {total_commits} total)")

    # Compute scores
    universities = []
    for domain, repo_weights in uni_repo_weighted.items():
        name = uni_map.get(domain, domain)
        total_score = 0.0
        repo_details = []
        for repo_slug in sorted(repo_weights, key=lambda r: -repo_weights[r]):
            stars = repo_stars.get(repo_slug, 0)
            weighted = repo_weights[repo_slug]
            commits = uni_repo_commits[domain][repo_slug]
            score = weighted * stars
            total_score += score
            repo_details.append({
                "repo": repo_slug,
                "commits": commits,
                "weighted_commits": round(weighted, 1),
                "stars": stars,
                "score": round(score),
            })
        universities.append({
            "domain": domain,
            "name": name,
            "score": round(total_score),
            "repos_contributed": len(repo_weights),
            "repos": repo_details,
        })

    universities.sort(key=lambda u: -u["score"])

    # Add ranks
    for i, u in enumerate(universities, 1):
        u["rank"] = i

    output = {
        "generated_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "total_repos": len(repos),
        "universities": universities,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"\nWrote {len(universities)} universities to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
