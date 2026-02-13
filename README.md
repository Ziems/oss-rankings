# OSS Rankings

Ranking universities by their contributions to popular open-source projects. Like [CSRankings](https://csrankings.org), but for open source instead of papers.

## How it works

1. A Python script clones repos listed in `repos.txt`
2. Extracts commit author emails from git history
3. Maps `.edu` emails (and aliases) to universities
4. Applies linear decay: earlier commits in a project's history count more
5. Fetches star counts from the GitHub API
6. Computes a score: **weighted commits x stars**, summed across all repos

## Project structure

```
data/
  repos.txt                # GitHub repos to analyze (one per line)
  universities.json        # .edu domain -> university name mapping
  aliases.json             # Personal email -> .edu domain mapping
scripts/
  collect.py               # Data collection script (inline deps via PEP 723)
site/                      # Next.js frontend
  public/rankings.json     # Generated output (not checked in)
```

## Running

### Collect data

```bash
uv run scripts/collect.py
```

Set `GITHUB_TOKEN` env var to avoid API rate limits.

### Run the site

```bash
cd site
npm install
npm run dev
```

## Contributing

- **Add repos**: Edit `data/repos.txt` and submit a PR
- **Fix university names**: Edit `data/universities.json`
- **Add your email alias**: Edit the `aliases` object in `data/aliases.json` to map your personal email to your `.edu` domain. You may only add your own email. You can remove your entry at any time either through PR or by submitting an issue.
