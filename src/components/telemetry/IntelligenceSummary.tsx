"use client";

/**
 * Curated intelligence walkthrough highlights from challenge/INTELLIGENCE_REPORT.md.
 * Static content for the Evaluation Trial "Intelligence Walkthrough".
 */
export default function IntelligenceSummary() {
  return (
    <div
      data-testid="intelligence-summary"
      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-violet-400"></span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
            Intelligence Walkthrough
          </h2>
        </div>
        <span className="font-mono text-[10px] text-zinc-500">PHASE 1 MODELS</span>
      </div>

      <div className="flex flex-col gap-4 text-xs text-zinc-400">
        <section>
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400/90">
            Congestion thresholds
          </h3>
          <p>
            Per-link power-law{" "}
            <span className="font-mono text-zinc-300">penalty = k × load_ratio^p</span>.
            Global MAE ~22.7s across 5,743 evaluation ticks. Highest-error links:{" "}
            <span className="font-mono text-amber-200">Elysium-Fenix</span>,{" "}
            <span className="font-mono text-amber-200">Boreas-Fenix</span>.
          </p>
        </section>

        <section>
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-400/90">
            Top spoofed links (trust model)
          </h3>
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <span className="font-mono text-red-300">Aegis-Elysium</span> — systematic
              under-reporting (~78s mean telemetry delta).
            </li>
            <li>
              <span className="font-mono text-red-300">Boreas-Fenix</span> — systematic
              under-reporting (~65s mean delta).
            </li>
          </ul>
          <p className="mt-1.5">
            Trust precision 92.1%, recall 70.4%. Links below trust floor{" "}
            <span className="font-mono text-zinc-300">0.5</span> are blocked by the
            Co-Pilot.
          </p>
        </section>

        <section>
          <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-400/90">
            Targeting &amp; route entropy
          </h3>
          <p>
            Logistic model on traffic share: higher share → higher jam probability. The
            True Cost router diversifies near-optimal paths (ε = 5%) to avoid painting a
            target on the busiest link.
          </p>
        </section>
      </div>
    </div>
  );
}
