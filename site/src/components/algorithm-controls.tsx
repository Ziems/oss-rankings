"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { AlgorithmParams, DecayFunction, StarScaling } from "@/lib/types";
import { DEFAULT_PARAMS } from "@/lib/types";

const DECAY_LABELS: Record<DecayFunction, string> = {
  harmonic: "Harmonic — 1/(k+1)",
  linear: "Linear — (N-k)/N",
  log: "Logarithmic — 1/ln(k+2)",
  sqrt: "Square Root — 1/√(k+1)",
  uniform: "Uniform — equal weight",
};

const STAR_SCALING_LABELS: Record<StarScaling, string> = {
  linear: "Linear — raw star count",
  log: "Logarithmic — ln(1 + stars)",
  sqrt: "Square Root — √stars",
};

interface AlgorithmControlsProps {
  params: AlgorithmParams;
  onChange: (params: AlgorithmParams) => void;
}

function set<K extends keyof AlgorithmParams>(
  params: AlgorithmParams,
  key: K,
  value: AlgorithmParams[K],
): AlgorithmParams {
  return { ...params, [key]: value };
}

export function AlgorithmControls({ params, onChange }: AlgorithmControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const p = params;

  const capLabel =
    p.capMultiplier === 0
      ? "Uncapped"
      : p.capMultiplier === 1
        ? "1x (default)"
        : `${p.capMultiplier}x`;

  const maxReposLabel =
    p.maxReposPerUni === 0 ? "All" : `Top ${p.maxReposPerUni}`;

  const topKLabel =
    p.topKContributors === 0 ? "All" : `Top ${p.topKContributors}`;

  const isDefault = JSON.stringify(p) === JSON.stringify(DEFAULT_PARAMS);

  return (
    <div className="rounded-lg border bg-card p-4 mb-8 space-y-4">
      {/* Row 1: Core controls */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Decay Function
          </label>
          <Select
            value={p.decayFn}
            onValueChange={(v) => onChange(set(p, "decayFn", v as DecayFunction))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DECAY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Star Weight: {p.starWeight}
          </label>
          <Slider
            value={[p.starWeight]}
            onValueChange={([v]) => onChange(set(p, "starWeight", v))}
            min={0}
            max={10}
            step={0.5}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Commit Weight: {p.commitWeight}
          </label>
          <Slider
            value={[p.commitWeight]}
            onValueChange={([v]) => onChange(set(p, "commitWeight", v))}
            min={0}
            max={10}
            step={0.5}
          />
        </div>
      </div>

      {/* Toggle advanced */}
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <span className={`inline-block transition-transform ${showAdvanced ? "rotate-90" : ""}`}>
          &#9654;
        </span>
        Advanced controls
      </button>

      {showAdvanced && (
        <div className="space-y-4 border-t pt-4">
          {/* Row 2 */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Star Scaling
              </label>
              <Select
                value={p.starScaling}
                onValueChange={(v) =>
                  onChange(set(p, "starScaling", v as StarScaling))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STAR_SCALING_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Per-Repo Cap: {capLabel}
              </label>
              <Slider
                value={[p.capMultiplier]}
                onValueChange={([v]) => onChange(set(p, "capMultiplier", v))}
                min={0}
                max={5}
                step={0.5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Max score from one repo as multiplier of importance. 0 = uncapped.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Min Commits: {p.minCommits === 0 ? "None" : p.minCommits}
              </label>
              <Slider
                value={[p.minCommits]}
                onValueChange={([v]) => onChange(set(p, "minCommits", v))}
                min={0}
                max={50}
                step={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Filter out contributors with fewer commits per repo.
              </p>
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Max Repos per University: {maxReposLabel}
              </label>
              <Slider
                value={[p.maxReposPerUni]}
                onValueChange={([v]) => onChange(set(p, "maxReposPerUni", v))}
                min={0}
                max={20}
                step={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only count top-N repos by score. 0 = all repos.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Top Contributors per Project: {topKLabel}
              </label>
              <Slider
                value={[p.topKContributors]}
                onValueChange={([v]) => onChange(set(p, "topKContributors", v))}
                min={0}
                max={50}
                step={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only count top-K contributors per project. 0 = all.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Diversity Bonus: {p.diversityBonus === 0 ? "Off" : `${(p.diversityBonus * 100).toFixed(0)}% per repo`}
              </label>
              <Slider
                value={[p.diversityBonus]}
                onValueChange={([v]) => onChange(set(p, "diversityBonus", v))}
                min={0}
                max={0.5}
                step={0.05}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Bonus multiplier per additional repo a university contributes to.
              </p>
            </div>
          </div>

          {/* Row 4: toggles */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={p.normalize}
                onCheckedChange={(v) => onChange(set(p, "normalize", v))}
              />
              <label className="text-sm font-medium">
                Normalize scores (top = 100)
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Formula + reset */}
      <div className="flex items-center justify-between border-t pt-3">
        <p className="text-xs text-muted-foreground font-mono leading-relaxed">
          importance = {p.starWeight} × {p.starScaling === "linear" ? "stars" : p.starScaling === "log" ? "ln(1+stars)" : "√stars"} + {p.commitWeight} × commits
          <br />
          score = {p.decayFn}(position) × importance
          {p.capMultiplier > 0 && `, capped at ${p.capMultiplier}× importance`}
          {p.diversityBonus > 0 && `, +${(p.diversityBonus * 100).toFixed(0)}%/repo bonus`}
          {p.normalize && ", normalized to 100"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(DEFAULT_PARAMS)}
          disabled={isDefault}
          className="shrink-0 ml-4"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
