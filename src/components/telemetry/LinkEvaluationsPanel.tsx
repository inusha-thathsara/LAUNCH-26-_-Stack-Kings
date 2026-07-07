"use client";

import { useState } from "react";
import type { LinkEvaluation } from "@/lib/relic/types";

import {
  isHighTargetingRisk,
  isLinkBlocked,
  trustScoreColor,
} from "./chimera-ui-utils";

interface LinkEvaluationsPanelProps {
  evaluations: LinkEvaluation[];
}

function worstTrustLink(evaluations: LinkEvaluation[]): LinkEvaluation | null {
  if (evaluations.length === 0) return null;
  return evaluations.reduce((worst, current) =>
    current.trust_score < worst.trust_score ? current : worst,
  );
}

function highestTargetingLink(evaluations: LinkEvaluation[]): LinkEvaluation | null {
  if (evaluations.length === 0) return null;
  return evaluations.reduce((worst, current) =>
    current.targeting_risk_score > worst.targeting_risk_score ? current : worst,
  );
}

function AuditBreakdown({ evaluation }: { evaluation: LinkEvaluation }) {
  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-white/5 bg-zinc-950/80 p-3 text-[11px] text-zinc-400">
      <p className="font-semibold text-zinc-300">Decision audit breakdown</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          <span className="text-zinc-500">Congestion penalty:</span>{" "}
          <span className="font-mono text-amber-300">
            {evaluation.predicted_congestion_penalty_ms.toFixed(1)} ms
          </span>{" "}
          — extra latency predicted from live load on this link.
        </li>
        <li>
          <span className="text-zinc-500">Trust score:</span>{" "}
          <span className="font-mono text-emerald-300">
            {evaluation.trust_score.toFixed(3)}
          </span>{" "}
          — telemetry honesty (0–1). Below 0.5 blocks the link.
        </li>
        <li>
          <span className="text-zinc-500">Targeting risk:</span>{" "}
          <span className="font-mono text-red-300">
            {evaluation.targeting_risk_score.toFixed(3)}
          </span>{" "}
          — probability Chimera jams predictable routes on this link.
        </li>
        <li>
          <span className="text-zinc-500">Combined cost:</span>{" "}
          <span className="font-mono text-zinc-200">
            {evaluation.combined_cost.toFixed(1)} ms-eq
          </span>{" "}
          — physics + penalties − entropy bonus used by the True Cost router.
        </li>
      </ul>
    </div>
  );
}

export default function LinkEvaluationsPanel({
  evaluations,
}: LinkEvaluationsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const worstTrust = worstTrustLink(evaluations);
  const highestTargeting = highestTargetingLink(evaluations);

  if (evaluations.length === 0) {
    return (
      <div
        data-testid="link-evaluations-panel"
        className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl shadow-2xl"
      >
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
          Link Evaluations
        </h2>
        <p className="text-xs text-zinc-500 italic">
          No interplanetary hops on this route.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="link-evaluations-panel"
      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400"></span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
            Link Evaluations
          </h2>
        </div>
        <span className="font-mono text-[10px] text-zinc-500">COUNCIL SCHEMA</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[11px]">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="pb-2 pr-3 font-semibold">Link</th>
              <th className="pb-2 pr-3 font-semibold">Congestion (ms)</th>
              <th className="pb-2 pr-3 font-semibold">Trust</th>
              <th className="pb-2 pr-3 font-semibold">Targeting</th>
              <th className="pb-2 font-semibold">Combined</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((evaluation) => {
              const isWorstTrust = worstTrust?.link_id === evaluation.link_id;
              const isHighestTargeting =
                highestTargeting?.link_id === evaluation.link_id;
              const blocked = isLinkBlocked(evaluation);
              const expanded = expandedId === evaluation.link_id;

              return (
                <tr
                  key={evaluation.link_id}
                  data-testid={`link-eval-row-${evaluation.link_id}`}
                  className={`cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5 ${
                    isWorstTrust ? "bg-red-950/20" : ""
                  } ${isHighestTargeting ? "bg-orange-950/15" : ""}`}
                  onClick={() => setExpandedId(expanded ? null : evaluation.link_id)}
                >
                  <td colSpan={5} className="py-0">
                    <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] items-center gap-2 py-2.5">
                      <div className="flex flex-col gap-0.5 pr-3">
                        <span
                          className="font-mono font-bold text-zinc-200"
                          style={{ color: trustScoreColor(evaluation.trust_score) }}
                        >
                          {evaluation.link_id}
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {blocked && (
                            <span className="rounded bg-red-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-300">
                              Blocked
                            </span>
                          )}
                          {isWorstTrust && (
                            <span className="rounded bg-red-900/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-200">
                              Lowest trust
                            </span>
                          )}
                          {isHighestTargeting && (
                            <span className="rounded bg-orange-900/40 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-200">
                              Highest targeting
                            </span>
                          )}
                          {isHighTargetingRisk(evaluation) && (
                            <span className="rounded bg-yellow-900/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-yellow-200">
                              Jam risk
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="font-mono text-amber-200/90">
                        {evaluation.predicted_congestion_penalty_ms.toFixed(1)}
                      </span>
                      <span
                        className="font-mono font-semibold"
                        style={{ color: trustScoreColor(evaluation.trust_score) }}
                      >
                        {evaluation.trust_score.toFixed(3)}
                      </span>
                      <span className="font-mono text-orange-300">
                        {evaluation.targeting_risk_score.toFixed(3)}
                      </span>
                      <span className="font-mono text-zinc-300">
                        {evaluation.combined_cost.toFixed(1)}
                      </span>
                    </div>
                    {expanded && <AuditBreakdown evaluation={evaluation} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-zinc-500">
        Click a row to expand the decision audit breakdown (practice for live Council
        Q&amp;A).
      </p>
    </div>
  );
}
