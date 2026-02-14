#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = ["requests"]
# ///
"""Collect open-source contribution data from GitHub repos and rank universities."""

import json
import math
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
    if email in aliases:
        return aliases[email]
    return extract_edu_domain(email)


def get_author_email_pairs(repo_dir: str) -> list[tuple[str, str]]:
    """Get (author_name, email) pairs from all commits (all branches)."""
    result = subprocess.run(
        ["git", "log", "--all", "--format=%aN\t%aE"],
        cwd=repo_dir,
        capture_output=True,
        text=True,
    )
    pairs = []
    for line in result.stdout.strip().splitlines():
        if "\t" not in line:
            continue
        name, email = line.split("\t", 1)
        name = name.strip()
        email = email.lower().strip()
        if name and email:
            pairs.append((name, email))
    return pairs


def build_auto_aliases(
    repo_dirs: list[str], uni_map: dict[str, str]
) -> dict[str, str]:
    """Discover email aliases by finding authors who use both .edu and non-.edu emails.

    If the same author name appears with a .edu email and a non-.edu email,
    map the non-.edu email to that university's domain.
    """
    # author_name -> set of emails
    name_to_emails: dict[str, set[str]] = defaultdict(set)

    print("\nDiscovering email aliases from git history...")
    for repo_dir in repo_dirs:
        for name, email in get_author_email_pairs(repo_dir):
            name_to_emails[name].add(email)

    auto_aliases: dict[str, str] = {}
    for name, emails in name_to_emails.items():
        # Find .edu domains for this author
        edu_domains = set()
        edu_emails = set()
        non_edu_emails = set()
        for email in emails:
            domain = extract_edu_domain(email)
            if domain:
                normalized = normalize_domain(domain, uni_map)
                edu_domains.add(normalized)
                edu_emails.add(email)
            else:
                non_edu_emails.add(email)

        # Only auto-alias if the author has exactly one .edu domain
        # (avoids ambiguity if someone has emails at multiple universities)
        if len(edu_domains) == 1 and non_edu_emails:
            edu_domain = next(iter(edu_domains))
            for email in non_edu_emails:
                auto_aliases[email] = edu_domain

    print(f"  Found {len(auto_aliases)} auto-aliases from {len(name_to_emails)} unique authors")
    for email, domain in sorted(auto_aliases.items(), key=lambda x: (x[1], x[0])):
        print(f"    {email} -> {domain}")
    return auto_aliases


def get_commits_with_order(repo_dir: str) -> list[tuple[str, str]]:
    """Get (author_name, email) in chronological commit order (oldest first)."""
    result = subprocess.run(
        ["git", "log", "--first-parent", "--reverse", "--format=%aN\t%aE"],
        cwd=repo_dir,
        capture_output=True,
        text=True,
    )
    commits = []
    for line in result.stdout.strip().splitlines():
        if "\t" not in line:
            continue
        name, email = line.split("\t", 1)
        commits.append((name.strip(), email.lower().strip()))
    return commits


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
    manual_aliases = load_aliases()

    print(f"Processing {len(repos)} repos...")
    if manual_aliases:
        print(f"Loaded {len(manual_aliases)} manual email aliases")

    # Phase 1: Clone/fetch all repos
    repo_dirs: dict[str, str] = {}  # slug -> dir
    for i, repo_slug in enumerate(repos, 1):
        print(f"[{i}/{len(repos)}] {repo_slug}")
        repo_dir = clone_or_fetch_repo(repo_slug)
        if repo_dir:
            repo_dirs[repo_slug] = repo_dir

    # Phase 2: Discover auto-aliases from git history
    auto_aliases = build_auto_aliases(list(repo_dirs.values()), uni_map)

    # Merge: manual aliases take precedence over auto-discovered ones
    aliases = {**auto_aliases, **manual_aliases}
    print(f"\nTotal aliases: {len(aliases)} ({len(manual_aliases)} manual + {len(auto_aliases)} auto-discovered)")

    # Phase 3: Score commits
    print("\nScoring commits...")
    uni_repo_weighted: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    uni_repo_commits: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    repo_stars: dict[str, int] = {}
    repo_total_commits: dict[str, int] = {}
    # Per-repo contributor tracking: repo_slug -> {author_name -> {commits, score, positions, domain, decay_sums}}
    repo_contributors: dict[str, dict[str, dict]] = defaultdict(lambda: defaultdict(lambda: {
        "commits": 0, "score": 0.0, "positions": [], "domain": "",
        "decay_sums": {"harmonic": 0.0, "linear": 0.0, "log": 0.0, "sqrt": 0.0, "uniform": 0.0},
    }))
    # Per university-repo decay sums
    uni_repo_decay: dict[str, dict[str, dict[str, float]]] = defaultdict(
        lambda: defaultdict(lambda: {"harmonic": 0.0, "linear": 0.0, "log": 0.0, "sqrt": 0.0, "uniform": 0.0})
    )

    for i, (repo_slug, repo_dir) in enumerate(repo_dirs.items(), 1):
        owner, repo = repo_slug.split("/", 1)
        print(f"[{i}/{len(repo_dirs)}] {repo_slug}")

        # Get stars
        stars = fetch_star_count(owner, repo)
        repo_stars[repo_slug] = stars
        print(f"  Stars: {stars:,}")

        # Get commits in chronological order
        commits_list = get_commits_with_order(repo_dir)
        total_commits = len(commits_list)
        repo_total_commits[repo_slug] = total_commits
        if total_commits == 0:
            print("  No commits found")
            continue

        # Harmonic decay: commit at position k (0-indexed, oldest first)
        # scores repo_importance / (k + 1). Early commits worth way more.
        # repo_importance = 2 * stars + total_commits
        repo_importance = 2 * stars + total_commits
        edu_count = 0
        for k, (name, email) in enumerate(commits_list):
            domain = resolve_email(email, aliases)
            if domain is None:
                continue
            domain = normalize_domain(domain, uni_map)
            weight = repo_importance / (k + 1)
            uni_repo_weighted[domain][repo_slug] += weight
            uni_repo_commits[domain][repo_slug] += 1
            edu_count += 1

            # Compute decay values for this commit position
            d_harmonic = 1.0 / (k + 1)
            d_linear = (total_commits - k) / total_commits
            d_log = 1.0 / math.log(k + 2)
            d_sqrt = 1.0 / math.sqrt(k + 1)
            d_uniform = 1.0

            # Accumulate per university-repo
            sums = uni_repo_decay[domain][repo_slug]
            sums["harmonic"] += d_harmonic
            sums["linear"] += d_linear
            sums["log"] += d_log
            sums["sqrt"] += d_sqrt
            sums["uniform"] += d_uniform

            # Track individual contributor positions
            contributor = repo_contributors[repo_slug][name]
            contributor["commits"] += 1
            contributor["score"] += weight
            contributor["domain"] = domain
            # Store positions as fraction of total (0.0 = first commit, 1.0 = last)
            contributor["positions"].append(k / total_commits)
            # Accumulate contributor decay sums
            contributor["decay_sums"]["harmonic"] += d_harmonic
            contributor["decay_sums"]["linear"] += d_linear
            contributor["decay_sums"]["log"] += d_log
            contributor["decay_sums"]["sqrt"] += d_sqrt
            contributor["decay_sums"]["uniform"] += d_uniform

        print(f"  Found {edu_count} .edu commits (of {total_commits} total)")

    # Compute scores
    universities = []
    for domain, repo_weights in uni_repo_weighted.items():
        name = uni_map.get(domain, domain)
        total_score = 0.0
        repo_details = []
        for repo_slug in sorted(repo_weights, key=lambda r: -repo_weights[r]):
            stars = repo_stars.get(repo_slug, 0)
            commits = uni_repo_commits[domain][repo_slug]
            total_commits = repo_total_commits.get(repo_slug, 1)
            repo_importance = 2 * stars + total_commits
            score = min(repo_weights[repo_slug], repo_importance)
            total_score += score
            decay = uni_repo_decay[domain].get(repo_slug, {"harmonic": 0, "linear": 0, "log": 0, "sqrt": 0, "uniform": 0})
            repo_details.append({
                "repo": repo_slug,
                "commits": commits,
                "stars": stars,
                "score": round(score),
                "decay_sums": {k: round(v, 4) for k, v in decay.items()},
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

    # Build project rankings
    projects = []
    for repo_slug in repo_dirs:
        stars = repo_stars.get(repo_slug, 0)
        total_commits = repo_total_commits.get(repo_slug, 0)
        contributors = repo_contributors.get(repo_slug, {})
        # Sort contributors by score descending
        top_contributors = []
        for author_name, data in sorted(contributors.items(), key=lambda x: -x[1]["score"]):
            uni_name = uni_map.get(data["domain"], data["domain"])
            # Compute median position for a summary stat
            positions = data["positions"]
            median_pos = sorted(positions)[len(positions) // 2] if positions else 0.5
            top_contributors.append({
                "name": author_name,
                "university": uni_name,
                "domain": data["domain"],
                "commits": data["commits"],
                "score": round(data["score"]),
                "first_commit_pct": round(min(positions) * 100, 1) if positions else 0,
                "median_commit_pct": round(median_pos * 100, 1),
                "last_commit_pct": round(max(positions) * 100, 1) if positions else 100,
                "decay_sums": {k: round(v, 4) for k, v in data["decay_sums"].items()},
            })
        project_total_score = sum(c["score"] for c in top_contributors)
        projects.append({
            "repo": repo_slug,
            "stars": stars,
            "total_commits": total_commits,
            "edu_contributors": len(contributors),
            "total_score": round(project_total_score),
            "contributors": top_contributors[:50],  # top 50 per repo
        })
    projects.sort(key=lambda p: -(2 * p["stars"] + p["total_commits"]))

    output = {
        "generated_at": __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat(),
        "total_repos": len(repos),
        "universities": universities,
        "projects": projects,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"\nWrote {len(universities)} universities to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
