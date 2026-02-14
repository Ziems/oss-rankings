export interface DecaySums {
  harmonic: number;  // Σ 1/(k+1)
  linear: number;    // Σ (N-k)/N
  log: number;       // Σ 1/ln(k+2)
  sqrt: number;      // Σ 1/√(k+1)
  uniform: number;   // count
}

export type DecayFunction = keyof DecaySums;

export type StarScaling = "linear" | "log" | "sqrt";

export interface AlgorithmParams {
  decayFn: DecayFunction;
  starWeight: number;
  commitWeight: number;
  starScaling: StarScaling;
  capMultiplier: number;       // 0 = uncapped, otherwise multiplier on importance
  minCommits: number;          // filter contributors with fewer commits
  maxReposPerUni: number;      // 0 = unlimited, otherwise top-N repos per university
  topKContributors: number;    // 0 = unlimited, otherwise top-K per project
  diversityBonus: number;      // 0–1, bonus % per additional repo contributed to
  normalize: boolean;          // normalize top score to 100
}

export const DEFAULT_PARAMS: AlgorithmParams = {
  decayFn: "harmonic",
  starWeight: 2,
  commitWeight: 1,
  starScaling: "linear",
  capMultiplier: 1,
  minCommits: 0,
  maxReposPerUni: 0,
  topKContributors: 0,
  diversityBonus: 0,
  normalize: false,
};

export interface RepoContribution {
  repo: string;
  commits: number;
  stars: number;
  score: number;
  decay_sums: DecaySums;
}

export interface University {
  rank: number;
  domain: string;
  name: string;
  score: number;
  repos_contributed: number;
  repos: RepoContribution[];
}

export interface ProjectContributor {
  name: string;
  university: string;
  domain: string;
  commits: number;
  score: number;
  first_commit_pct: number;
  median_commit_pct: number;
  last_commit_pct: number;
  decay_sums: DecaySums;
}

export interface Project {
  repo: string;
  stars: number;
  total_commits: number;
  edu_contributors: number;
  total_score: number;
  contributors: ProjectContributor[];
}

export interface RankingsData {
  generated_at: string;
  total_repos: number;
  universities: University[];
  projects: Project[];
}
