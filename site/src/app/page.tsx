import fs from "fs";
import path from "path";
import { RankingsPage } from "@/components/rankings-page";
import type { RankingsData } from "@/lib/types";

function loadRankings(): RankingsData | null {
  const filePath = path.join(process.cwd(), "public", "rankings.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function Home() {
  const data = loadRankings();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">OSS Rankings</h1>
          <p className="mt-2 text-muted-foreground">
            Ranking universities by their contributions to popular open-source
            projects.
          </p>
          <p className="text-sm text-muted-foreground">
            Earlier commits count more. Click a row to see the breakdown.
          </p>
        </div>

        {data ? (
          <RankingsPage data={data} />
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p className="font-medium">No rankings data yet.</p>
            <p className="mt-1 text-sm">
              Run{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
                uv run scripts/collect.py
              </code>{" "}
              to generate rankings.json.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
