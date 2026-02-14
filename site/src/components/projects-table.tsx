"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Project, ProjectContributor } from "@/lib/types";

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function CommitTimeline({ contributor }: { contributor: ProjectContributor }) {
  // Visualize when commits happened as a bar spanning first to last commit
  const first = contributor.first_commit_pct;
  const last = contributor.last_commit_pct;
  const median = contributor.median_commit_pct;

  return (
    <div className="relative h-3 w-full rounded bg-muted" title={`Commits from ${first}% to ${last}% of project history (median: ${median}%)`}>
      {/* Range bar */}
      <div
        className="absolute top-0 h-full rounded bg-primary/30"
        style={{
          left: `${first}%`,
          width: `${Math.max(last - first, 0.5)}%`,
        }}
      />
      {/* Median dot */}
      <div
        className="absolute top-0 h-full w-1.5 rounded-full bg-primary"
        style={{ left: `${median}%` }}
      />
    </div>
  );
}

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead>Stars</TableHead>
          <TableHead>Commits</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>.edu Contributors</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <Collapsible
            key={project.repo}
            asChild
            open={expandedRow === project.repo}
            onOpenChange={(open) =>
              setExpandedRow(open ? project.repo : null)
            }
          >
            <>
              <CollapsibleTrigger asChild>
                <TableRow className="cursor-pointer">
                  <TableCell className="font-medium">
                    <a
                      href={`https://github.com/${project.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {project.repo}
                    </a>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatNumber(project.stars)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatNumber(project.total_commits)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatNumber(project.total_score)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {project.edu_contributors}
                  </TableCell>
                </TableRow>
              </CollapsibleTrigger>
              <CollapsibleContent asChild>
                <tr>
                  <td colSpan={5} className="p-0">
                    <div className="bg-muted/30 px-6 py-3">
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Timeline: when commits occurred in project history</span>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-6 rounded bg-primary/30" />
                          <span>range</span>
                          <div className="h-2 w-1.5 rounded-full bg-primary" />
                          <span>median</span>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground text-xs">
                            <th className="text-left py-1 font-medium w-48">
                              Contributor
                            </th>
                            <th className="text-left py-1 font-medium w-40">
                              University
                            </th>
                            <th className="text-right py-1 font-medium w-20">
                              Commits
                            </th>
                            <th className="text-right py-1 font-medium w-20">
                              Score
                            </th>
                            <th className="text-left py-1 pl-4 font-medium">
                              Timeline
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {project.contributors.map((c) => (
                            <tr key={c.name}>
                              <td className="py-1.5 truncate max-w-48">
                                {c.name}
                              </td>
                              <td className="py-1.5 text-muted-foreground truncate max-w-40">
                                {c.university}
                              </td>
                              <td className="text-right font-mono py-1.5">
                                {c.commits.toLocaleString()}
                              </td>
                              <td className="text-right font-mono py-1.5">
                                {formatNumber(c.score)}
                              </td>
                              <td className="py-1.5 pl-4">
                                <CommitTimeline contributor={c} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </CollapsibleContent>
            </>
          </Collapsible>
        ))}
      </TableBody>
    </Table>
  );
}
