"use client";

import { useState, useMemo } from "react";
import { AlgorithmControls } from "@/components/algorithm-controls";
import { RankingsTable } from "@/components/rankings-table";
import { ProjectsTable } from "@/components/projects-table";
import type {
  AlgorithmParams,
  RankingsData,
  University,
  Project,
  StarScaling,
} from "@/lib/types";
import { DEFAULT_PARAMS } from "@/lib/types";

interface RankingsPageProps {
  data: RankingsData;
}

function scaleStars(stars: number, scaling: StarScaling): number {
  switch (scaling) {
    case "log":
      return Math.log(1 + stars);
    case "sqrt":
      return Math.sqrt(stars);
    case "linear":
    default:
      return stars;
  }
}

export function RankingsPage({ data }: RankingsPageProps) {
  const [params, setParams] = useState<AlgorithmParams>(DEFAULT_PARAMS);

  const recomputed = useMemo(() => {
    const {
      decayFn,
      starWeight,
      commitWeight,
      starScaling,
      capMultiplier,
      minCommits,
      maxReposPerUni,
      topKContributors,
      diversityBonus,
      normalize,
    } = params;

    // Build a lookup for repo total_commits from projects
    const repoInfo = new Map(
      data.projects.map((p) => [p.repo, p.total_commits])
    );

    const computeImportance = (stars: number, totalCommits: number) =>
      starWeight * scaleStars(stars, starScaling) + commitWeight * totalCommits;

    // --- Recompute universities ---
    const universities: University[] = data.universities.map((uni) => {
      // First pass: compute per-repo scores
      const reposWithScores = uni.repos
        .filter((r) => minCommits === 0 || r.commits >= minCommits)
        .map((r) => {
          const imp = computeImportance(r.stars, repoInfo.get(r.repo) ?? 0);
          const rawScore = r.decay_sums[decayFn] * imp;
          const score =
            capMultiplier > 0 ? Math.min(rawScore, capMultiplier * imp) : rawScore;
          return { ...r, score: Math.round(score), _imp: imp };
        })
        .sort((a, b) => b.score - a.score);

      // Apply max repos limit
      const activeRepos =
        maxReposPerUni > 0 ? reposWithScores.slice(0, maxReposPerUni) : reposWithScores;

      let totalScore = activeRepos.reduce((sum, r) => sum + r.score, 0);

      // Diversity bonus: +X% per repo beyond the first
      if (diversityBonus > 0 && activeRepos.length > 1) {
        totalScore *= 1 + diversityBonus * (activeRepos.length - 1);
      }

      return {
        ...uni,
        score: Math.round(totalScore),
        repos: reposWithScores, // show all repos in detail, even if maxRepos limits the total
      };
    });

    // Re-rank
    universities.sort((a, b) => b.score - a.score);
    universities.forEach((u, i) => (u.rank = i + 1));

    // Normalize universities
    if (normalize && universities.length > 0 && universities[0].score > 0) {
      const topScore = universities[0].score;
      for (const u of universities) {
        u.score = Math.round((u.score / topScore) * 100);
      }
    }

    // --- Recompute projects ---
    const projects: Project[] = data.projects.map((p) => {
      const imp = computeImportance(p.stars, p.total_commits);

      let contributors = p.contributors
        .filter((c) => minCommits === 0 || c.commits >= minCommits)
        .map((c) => {
          const rawScore = c.decay_sums[decayFn] * imp;
          const score =
            capMultiplier > 0 ? Math.min(rawScore, capMultiplier * imp) : rawScore;
          return { ...c, score: Math.round(score) };
        })
        .sort((a, b) => b.score - a.score);

      if (topKContributors > 0) {
        contributors = contributors.slice(0, topKContributors);
      }

      const totalScore = contributors.reduce((sum, c) => sum + c.score, 0);
      return { ...p, total_score: totalScore, contributors };
    });

    return { universities, projects };
  }, [data, params]);

  return (
    <>
      <AlgorithmControls params={params} onChange={setParams} />

      <RankingsTable universities={recomputed.universities} />

      <div className="mt-16 mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Click a project to see its university-affiliated contributors and when
          they committed.
        </p>
      </div>

      <ProjectsTable projects={recomputed.projects} />

      <p className="mt-6 text-xs text-muted-foreground">
        Data from {data.total_repos} repos. Last updated{" "}
        {new Date(data.generated_at).toLocaleDateString()}.
      </p>
    </>
  );
}
