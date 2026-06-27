"use client";

import type { LatencyBreakdown } from "@/lib/relic/types";

interface LatencyMetricsProps {
  status: "pending" | "delivered" | "undeliverable";
  breakdown: LatencyBreakdown | null;
  totalLatency: number;
  undeliverableReason?: string;
}

export default function LatencyMetrics({
  status,
  breakdown,
  totalLatency,
  undeliverableReason,
}: LatencyMetricsProps) {
  const isDelivered = status === "delivered";
  const isUndeliverable = status === "undeliverable";

  // Calculate percentages for the stacked/progress indicators
  const total = breakdown?.total_ms || 1;
  const fiberPct = breakdown ? ((breakdown.fiber_ms / total) * 100).toFixed(1) : "0";
  const towerPct = breakdown ? ((breakdown.tower_ms / total) * 100).toFixed(1) : "0";
  const atmosPct = breakdown ? ((breakdown.atmosphere_ms / total) * 100).toFixed(1) : "0";
  const voidPct = breakdown ? ((breakdown.void_ms / total) * 100).toFixed(1) : "0";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400"></span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
            Latency & Propagation Telemetry
          </h2>
        </div>
        <span className="font-mono text-[10px] text-zinc-400">
          PHYSICAL PROPAGATION METRICS
        </span>
      </div>

      {/* Main Status Panel */}
      <div className="relative overflow-hidden rounded-xl border border-white/5 bg-zinc-950 p-4">
        {/* Glow backdrop based on status */}
        <div
          className={`absolute -right-16 -top-16 h-36 w-36 rounded-full blur-3xl transition-colors duration-500 ${
            isDelivered
              ? "bg-emerald-500/10"
              : isUndeliverable
              ? "bg-red-500/10"
              : "bg-zinc-500/10"
          }`}
        ></div>

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-zinc-500">
              Transmission Status
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  isDelivered
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : isUndeliverable
                    ? "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse"
                    : "bg-zinc-800 text-zinc-400 border border-white/5"
                }`}
              >
                {status}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-0.5">
            <span className="text-[9px] uppercase tracking-widest text-zinc-500">
              End-to-End Latency
            </span>
            <span className="font-mono text-2xl font-black tracking-tight text-white">
              {isDelivered ? `${totalLatency.toFixed(3)} ms` : "0.000 ms"}
            </span>
          </div>
        </div>

        {isUndeliverable && undeliverableReason && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-300 font-mono">
            ⚠️ ERROR: {undeliverableReason}
          </div>
        )}
      </div>

      {/* Component Gauges */}
      {isDelivered && breakdown && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Subsurface Fiber Arc Transit */}
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-zinc-950/40 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">Subsurface Fiber</span>
                <span className="font-mono font-bold text-sky-400">
                  {breakdown.fiber_ms.toFixed(3)} ms ({fiberPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-500"
                  style={{ width: `${fiberPct}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                Formula: Arc transit along equatorial planet fiber at 0.67c.
              </p>
            </div>

            {/* Processing Tower Delay */}
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-zinc-950/40 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">Processing Towers</span>
                <span className="font-mono font-bold text-amber-400">
                  {breakdown.tower_ms.toFixed(3)} ms ({towerPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
                  style={{ width: `${towerPct}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                Formula: m × 7 ms processing penalty per distinct tower hit.
              </p>
            </div>

            {/* Atmospheric Refraction Delay */}
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-zinc-950/40 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">Atmospheric Refraction</span>
                <span className="font-mono font-bold text-purple-400">
                  {breakdown.atmosphere_ms.toFixed(3)} ms ({atmosPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                  style={{ width: `${atmosPct}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                Formula: Signal index delay through ionized atmospheric shell h.
              </p>
            </div>

            {/* Void Transmission */}
            <div className="flex flex-col gap-2 rounded-xl border border-white/5 bg-zinc-950/40 p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">Void Transmission</span>
                <span className="font-mono font-bold text-emerald-400">
                  {breakdown.void_ms.toFixed(3)} ms ({voidPct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                  style={{ width: `${voidPct}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">
                Formula: Laser speed-of-light vacuum transmission across distance L.
              </p>
            </div>
          </div>
        </div>
      )}

      {!isDelivered && !isUndeliverable && (
        <div className="flex h-36 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-xs text-zinc-500 font-mono">
          Awaiting packet transmission telemetry...
        </div>
      )}
    </div>
  );
}
