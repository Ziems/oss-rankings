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
import type { University } from "@/lib/types";

type SortKey = "rank" | "name" | "score" | "repos_contributed";
type SortDir = "asc" | "desc";

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <span className="ml-1 text-muted-foreground/40">&#x2195;</span>;
  }
  return <span className="ml-1">{dir === "asc" ? "\u2191" : "\u2193"}</span>;
}

export function RankingsTable({
  universities,
}: {
  universities: University[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = [...universities].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "name") return mul * a.name.localeCompare(b.name);
    return mul * (a[sortKey] - b[sortKey]);
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {(
            [
              ["rank", "Rank"],
              ["name", "University"],
              ["score", "Score"],
              ["repos_contributed", "Repos"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <TableHead
              key={key}
              className="cursor-pointer select-none"
              onClick={() => handleSort(key)}
            >
              {label}
              <SortIcon active={sortKey === key} dir={sortDir} />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((uni) => (
          <Collapsible
            key={uni.domain}
            asChild
            open={expandedRow === uni.domain}
            onOpenChange={(open) =>
              setExpandedRow(open ? uni.domain : null)
            }
          >
            <>
              <CollapsibleTrigger asChild>
                <TableRow className="cursor-pointer">
                  <TableCell className="font-mono w-16">
                    {uni.rank}
                  </TableCell>
                  <TableCell className="font-medium">{uni.name}</TableCell>
                  <TableCell className="font-mono">
                    {formatNumber(uni.score)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {uni.repos_contributed}
                  </TableCell>
                </TableRow>
              </CollapsibleTrigger>
              <CollapsibleContent asChild>
                <tr>
                  <td colSpan={4} className="p-0">
                    <div className="bg-muted/30 px-6 py-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground text-xs">
                            <th className="text-left py-1 font-medium">
                              Repository
                            </th>
                            <th className="text-right py-1 font-medium">
                              Commits
                            </th>
                            <th className="text-right py-1 font-medium">
                              Stars
                            </th>
                            <th className="text-right py-1 font-medium">
                              Score
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...uni.repos].sort((a, b) => b.score - a.score).map((r) => (
                            <tr key={r.repo}>
                              <td className="py-1">
                                <a
                                  href={`https://github.com/${r.repo}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline-offset-4 hover:underline"
                                >
                                  {r.repo}
                                </a>
                              </td>
                              <td className="text-right font-mono py-1">
                                {r.commits.toLocaleString()}
                              </td>
                              <td className="text-right font-mono py-1">
                                {formatNumber(r.stars)}
                              </td>
                              <td className="text-right font-mono py-1">
                                {formatNumber(r.score)}
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
