export interface RepoContribution {
  repo: string;
  commits: number;
  weighted_commits: number;
  stars: number;
  score: number;
}

export interface University {
  rank: number;
  domain: string;
  name: string;
  score: number;
  repos_contributed: number;
  repos: RepoContribution[];
}

export interface RankingsData {
  generated_at: string;
  total_repos: number;
  universities: University[];
}
