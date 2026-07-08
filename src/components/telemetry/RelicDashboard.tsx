"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PlanetNode,
  UniverseMetadata,
  Phase2RoutingReport,
} from "@/lib/relic/types";
import type { VoidEdge } from "@/lib/relic/graph";
import type { TransmissionResult } from "@/lib/relic/transmission";
import SpaceMap, { type PathViewMode } from "./SpaceMap";
import CodexTerminal from "./CodexTerminal";
import LatencyMetrics from "./LatencyMetrics";
import LinkEvaluationsPanel from "./LinkEvaluationsPanel";
import IntelligenceSummary from "./IntelligenceSummary";
import {
  parseBaselinePathFromExplanation,
  previewParseIntent,
} from "./chimera-ui-utils";

interface UniverseResponse {
  metadata: UniverseMetadata;
  nodes: PlanetNode[];
  adjacency: Record<string, string[]>;
  edges: VoidEdge[];
}

interface RelicDashboardProps {
  appVersion: string;
}

export default function RelicDashboard({ appVersion }: RelicDashboardProps) {
  const [universe, setUniverse] = useState<UniverseResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [payload, setPayload] = useState("Hello world");
  const [deadNodes, setDeadNodes] = useState<Set<string>>(new Set());
  const [deadLinks, setDeadLinks] = useState<Set<string>>(new Set());

  const [result, setResult] = useState<TransmissionResult | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [nlRequest, setNlRequest] = useState("Send Hello world from Aegis to Caelum");
  const [routingReport, setRoutingReport] = useState<Phase2RoutingReport | null>(null);
  const [routingLoading, setRoutingLoading] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [pathView, setPathView] = useState<PathViewMode>("chosen");

  // Phase 5 — live chaos pivot monitoring
  const [liveMonitor, setLiveMonitor] = useState(false);
  const [pivotNotice, setPivotNotice] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  const lastPathRef = useRef<string | null>(null);
  const pollInFlightRef = useRef(false);

  const baselinePath = useMemo(
    () =>
      routingReport
        ? parseBaselinePathFromExplanation(routingReport.explanation)
        : null,
    [routingReport],
  );

  // Live, client-side preview of the parsed intent shown BEFORE routing.
  const previewIntent = useMemo(
    () => previewParseIntent(nlRequest, universe?.nodes.map((n) => n.id) ?? []),
    [nlRequest, universe],
  );

  // Load universe config
  useEffect(() => {
    fetch("/api/universe")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load universe");
        return data as UniverseResponse;
      })
      .then((data) => {
        setUniverse(data);
        if (data.nodes.length > 0) {
          const first = data.nodes[0]!;
          const last = data.nodes[data.nodes.length - 1]!;
          setOrigin(first.id);
          setDestination(last.id);
        }
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "Unknown error");
      });
  }, [reloadToken]);

  const reachableEdges = useMemo(
    () => universe?.edges.filter((edge) => edge.within_lmax) ?? [],
    [universe],
  );

  function toggleNode(id: string) {
    setDeadNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function linkKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function toggleLink(a: string, b: string) {
    setDeadLinks((prev) => {
      const next = new Set(prev);
      const key = linkKey(a, b);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function resetChaos() {
    setDeadNodes(new Set());
    setDeadLinks(new Set());
    setSendError(null);
  }

  // Pre-configured scenarios. Planet/link targets are derived from the loaded
  // universe (never hardcoded) so they survive config changes.
  function applyScenario(scenario: string) {
    resetChaos();
    if (!universe) return;

    const planets = universe.nodes.map((n) => n.id);
    // Interior planets exclude the first/last (the default origin/destination),
    // so a scenario doesn't trivially black out the endpoints.
    const interior = planets.slice(1, -1);

    switch (scenario) {
      case "baseline":
        // All clear
        break;
      case "hyperflare":
        // Solar flare severs the first couple of reachable void links.
        setDeadLinks(
          new Set(reachableEdges.slice(0, 2).map((e) => linkKey(e.from, e.to))),
        );
        break;
      case "distortion": {
        // A single interior planet's atmosphere goes hyper-refractive (offline).
        const victim = interior[0] ?? planets[0];
        if (victim) setDeadNodes(new Set([victim]));
        break;
      }
      case "blackout": {
        // Two interior planets go completely offline.
        const victims = interior.length >= 2 ? interior.slice(0, 2) : interior;
        if (victims.length > 0) setDeadNodes(new Set(victims));
        break;
      }
      case "chaos": {
        // Randomly take one interior planet and up to two links down.
        if (interior.length > 0) {
          const randomPlanet = interior[Math.floor(Math.random() * interior.length)]!;
          setDeadNodes(new Set([randomPlanet]));
        }
        const randomLinks = new Set<string>();
        for (let i = 0; i < 2 && reachableEdges.length > 0; i++) {
          const edge =
            reachableEdges[Math.floor(Math.random() * reachableEdges.length)]!;
          randomLinks.add(linkKey(edge.from, edge.to));
        }
        setDeadLinks(randomLinks);
        break;
      }
    }
  }

  const transmit = useCallback(async () => {
    if (!origin || !destination) return;
    setSending(true);
    setSendError(null);
    setResult(null);
    try {
      const blockedEdges = [...deadLinks].map((key) => key.split("|"));
      const res = await fetch("/api/transmit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          payload,
          blockedNodes: [...deadNodes],
          blockedEdges,
          use_copilot: routingReport !== null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transmission failed");
      setResult(data as TransmissionResult);
    } catch (error: unknown) {
      setSendError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }, [origin, destination, payload, deadNodes, deadLinks, routingReport]);

  const routeWithCopilot = useCallback(
    async (options?: { refresh?: boolean }) => {
      const trimmed = nlRequest.trim();
      if (!trimmed || pollInFlightRef.current) return;

      const isRefresh = options?.refresh ?? false;
      pollInFlightRef.current = true;

      if (!isRefresh) {
        setRoutingLoading(true);
        setRoutingError(null);
        setRoutingReport(null);
        setPathView("chosen");
        lastPathRef.current = null;
      }

      try {
        const res = await fetch("/api/route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: trimmed }),
        });
        const data = (await res.json()) as Phase2RoutingReport & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Co-Pilot routing failed");
        }

        const newPath = data.chosen_path.join(" → ");
        if (lastPathRef.current && lastPathRef.current !== newPath) {
          setPivotNotice(`Path pivoted: ${lastPathRef.current}  ➜  ${newPath}`);
        }
        lastPathRef.current = newPath;

        setRoutingReport(data);
        setOrigin(data.origin_id);
        setDestination(data.destination_id);
        // Carry the parsed payload into the beam so a Co-Pilot route transmits
        // the actual requested message (the report schema omits payload).
        if (!isRefresh) {
          const parsed = previewParseIntent(
            trimmed,
            universe?.nodes.map((n) => n.id) ?? [],
          );
          if (parsed.payload) setPayload(parsed.payload);
        }
        if (isRefresh) {
          setRoutingError(null);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (isRefresh) {
          // Keep the last good report visible during live monitoring glitches.
          setPivotNotice(`Live re-route failed: ${message}`);
        } else {
          setRoutingError(message);
        }
      } finally {
        pollInFlightRef.current = false;
        if (!isRefresh) {
          setRoutingLoading(false);
        }
      }
    },
    [nlRequest, universe],
  );

  // Live chaos pivot: re-poll the Co-Pilot on an interval and surface path changes.
  // Does NOT depend on routingReport — clearing the report during refresh would stop polling.
  useEffect(() => {
    if (!liveMonitor) return;
    const handle = setInterval(() => {
      if (!lastPathRef.current) return;
      setPollCount((n) => n + 1);
      void routeWithCopilot({ refresh: true });
    }, 4000);
    return () => clearInterval(handle);
  }, [liveMonitor, routeWithCopilot]);

  // Auto-dismiss the pivot banner a few seconds after it appears.
  useEffect(() => {
    if (!pivotNotice) return;
    const handle = setTimeout(() => setPivotNotice(null), 6000);
    return () => clearTimeout(handle);
  }, [pivotNotice]);

  // Debounced auto-trigger for a reactive simulation experience.
  // a timeout keeps the setState calls out of the synchronous effect body and
  // coalesces rapid edits (e.g. typing in the payload field).
  useEffect(() => {
    if (!(origin && destination && payload && universe)) return;
    const handle = setTimeout(() => {
      void transmit();
    }, 250);
    return () => clearTimeout(handle);
  }, [origin, destination, payload, deadNodes, deadLinks, universe, transmit]);

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 selection:bg-emerald-500/30">
      {/* Visual Stars Backdrop Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none"></div>

      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 relative z-10 sm:px-6 lg:gap-8">
        {/* Header telemetry HUD */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/10 pb-6 gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Relic Ring Protocol
              </span>
              <span className="rounded bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                Chimera Co-Pilot
              </span>
              <span
                className="text-[10px] font-mono text-zinc-500"
                data-testid="app-version"
              >
                v{appVersion} <span className="text-zinc-600">· PROT-STABLE</span>
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl bg-gradient-to-r from-white via-zinc-100 to-zinc-500 bg-clip-text text-transparent">
              {universe?.metadata.system_name ?? "Zeta-26"} Telemetry Console
            </h1>
            <p className="text-xs text-zinc-400">
              Low-latency equatorial fiber and void laser routing simulation dashboard.
            </p>
          </div>

          {/* Quick Stats Panel */}
          {universe && (
            <div className="flex gap-4 rounded-xl border border-white/5 bg-zinc-900/40 p-3 text-xs font-mono backdrop-blur-md">
              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">C-Fraction</span>
                <span className="text-zinc-200 font-bold">
                  {(universe.metadata.fiber_speed_fraction * 100).toFixed(0)}% (fiber)
                </span>
              </div>
              <div className="h-6 w-px bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Lmax Limit</span>
                <span className="text-zinc-200 font-bold">
                  {(universe.metadata.max_void_hop_distance_km / 1_000_000).toFixed(0)}M
                  km
                </span>
              </div>
              <div className="h-6 w-px bg-white/10"></div>
              <div className="flex flex-col">
                <span className="text-[9px] text-zinc-500 uppercase">Tower delay</span>
                <span className="text-zinc-200 font-bold">
                  {universe.metadata.tower_processing_delay_ms} ms
                </span>
              </div>
            </div>
          )}
        </header>

        {loadError && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <span>Error loading Zeta-26 universe map: {loadError}</span>
            <button
              type="button"
              onClick={() => {
                setLoadError(null);
                setReloadToken((n) => n + 1);
              }}
              className="shrink-0 rounded-lg border border-red-400/40 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-950/70 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {universe && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
            {/* Control HUD Sidebar */}
            <aside className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-zinc-900/40 p-5 backdrop-blur-xl shadow-2xl">
              {/* Presets and Chaos Trigger */}
              <div className="flex flex-col gap-2.5">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Simulation Scenarios
                </h3>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => applyScenario("baseline")}
                    className="rounded-lg border border-white/5 bg-zinc-950/60 py-2 text-center text-zinc-300 hover:border-white/15 hover:bg-zinc-950 transition-all cursor-pointer"
                  >
                    🟢 Baseline
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScenario("hyperflare")}
                    className="rounded-lg border border-white/5 bg-zinc-950/60 py-2 text-center text-zinc-300 hover:border-white/15 hover:bg-zinc-950 transition-all cursor-pointer"
                  >
                    ☄️ Hyper-Flare
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScenario("distortion")}
                    className="rounded-lg border border-white/5 bg-zinc-950/60 py-2 text-center text-zinc-300 hover:border-white/15 hover:bg-zinc-950 transition-all cursor-pointer"
                  >
                    🌪️ Distortion
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScenario("blackout")}
                    className="rounded-lg border border-white/5 bg-zinc-950/60 py-2 text-center text-zinc-300 hover:border-white/15 hover:bg-zinc-950 transition-all cursor-pointer"
                  >
                    🌑 Blackout
                  </button>
                </div>
                <div className="flex gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => applyScenario("chaos")}
                    className="flex-1 rounded-lg bg-red-950/50 hover:bg-red-950/80 border border-red-500/20 py-2 text-center text-xs font-bold text-red-300 transition-all cursor-pointer"
                  >
                    💥 Chaos Trigger
                  </button>
                  <button
                    type="button"
                    onClick={resetChaos}
                    className="rounded-lg bg-zinc-800 hover:bg-zinc-700 py-2 px-3 text-xs font-bold text-zinc-300 transition-all cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="h-px bg-white/10 my-1"></div>

              {/* Core Parameters */}
              <div className="flex flex-col gap-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  Routing Parameters
                </h3>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="origin-terminal"
                    className="text-[10px] font-medium uppercase text-zinc-500"
                  >
                    Origin Terminal
                  </label>
                  <select
                    id="origin-terminal"
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 transition-all"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                  >
                    {universe.nodes.map((node) => (
                      <option
                        key={node.id}
                        value={node.id}
                        disabled={deadNodes.has(node.id)}
                      >
                        {node.id}{" "}
                        {deadNodes.has(node.id) ? " (OFFLINE)" : `(base ${node.codex})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="destination-terminal"
                    className="text-[10px] font-medium uppercase text-zinc-500"
                  >
                    Destination Terminal
                  </label>
                  <select
                    id="destination-terminal"
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 transition-all"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  >
                    {universe.nodes.map((node) => (
                      <option
                        key={node.id}
                        value={node.id}
                        disabled={deadNodes.has(node.id)}
                      >
                        {node.id}{" "}
                        {deadNodes.has(node.id) ? " (OFFLINE)" : `(base ${node.codex})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payload-message"
                    className="text-[10px] font-medium uppercase text-zinc-500"
                  >
                    Payload Message
                  </label>
                  <input
                    id="payload-message"
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 transition-all font-mono"
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder="Enter payload..."
                  />
                </div>
              </div>

              <div className="h-px bg-white/10 my-1"></div>

              {/* Phase 2 — Co-Pilot NL routing */}
              <div className="flex flex-col gap-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-cyan-400/90">
                  Co-Pilot Natural Language
                </h3>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="nl-copilot-request"
                    className="text-[10px] font-medium uppercase text-zinc-500"
                  >
                    Routing Request
                  </label>
                  <textarea
                    id="nl-copilot-request"
                    data-testid="nl-copilot-input"
                    rows={3}
                    className="resize-none rounded-lg border border-cyan-500/20 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-cyan-500/50 transition-all font-mono"
                    value={nlRequest}
                    onChange={(e) => setNlRequest(e.target.value)}
                    placeholder='e.g. "Send status ping from Boreas to Fenix"'
                  />
                </div>
                {(routingReport ||
                  previewIntent.origin ||
                  previewIntent.destination ||
                  previewIntent.payload) && (
                  <div
                    data-testid="parsed-intent"
                    className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-[11px] font-mono text-cyan-100/90"
                  >
                    <span className="text-cyan-500/70 uppercase text-[9px] font-bold tracking-wider block mb-1">
                      {routingReport ? "Parsed intent" : "Parsed intent (preview)"}
                    </span>
                    <div>
                      <span className="text-cyan-400">
                        {routingReport?.origin_id ?? previewIntent.origin ?? "?"}
                      </span>
                      {" → "}
                      <span className="text-cyan-400">
                        {routingReport?.destination_id ??
                          previewIntent.destination ??
                          "?"}
                      </span>
                    </div>
                    {previewIntent.payload && (
                      <div className="mt-0.5 text-cyan-100/70">
                        payload:{" "}
                        <span className="text-cyan-200">
                          &quot;{previewIntent.payload}&quot;
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  data-testid="copilot-route-button"
                  onClick={() => void routeWithCopilot()}
                  disabled={routingLoading || !nlRequest.trim()}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-cyan-500/10"
                >
                  {routingLoading ? "Co-Pilot routing..." : "Route with Co-Pilot"}
                </button>
                <button
                  type="button"
                  data-testid="live-monitor-toggle"
                  onClick={() => setLiveMonitor((v) => !v)}
                  disabled={!routingReport}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2 text-[11px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 ${
                    liveMonitor
                      ? "bg-red-950/60 border border-red-500/40 text-red-300"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      liveMonitor ? "animate-pulse bg-red-400" : "bg-zinc-500"
                    }`}
                  ></span>
                  {liveMonitor
                    ? `Live Monitor ON · ${pollCount}`
                    : "Live Chaos Monitor"}
                </button>
              </div>

              <div className="h-px bg-white/10 my-1"></div>

              {/* Chaos Status Summary */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  <span>Offline Zones</span>
                  <span className="text-[9px] text-zinc-600 font-mono">
                    PLANETS: {deadNodes.size} · LINKS: {deadLinks.size}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-auto">
                  {deadNodes.size === 0 && deadLinks.size === 0 ? (
                    <span className="text-[10px] text-zinc-500 italic">
                      No network faults detected. All systems green.
                    </span>
                  ) : (
                    <>
                      {[...deadNodes].map((nodeId) => (
                        <button
                          key={nodeId}
                          type="button"
                          onClick={() => toggleNode(nodeId)}
                          className="rounded bg-red-950/40 hover:bg-red-950 text-red-400 border border-red-500/20 px-2 py-0.5 text-[10px] font-mono cursor-pointer transition-colors"
                        >
                          Node: {nodeId} ⨯
                        </button>
                      ))}
                      {[...deadLinks].map((key) => {
                        const [a, b] = key.split("|");
                        if (!a || !b) return null;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleLink(a, b)}
                            className="rounded bg-orange-950/40 hover:bg-orange-950 text-orange-400 border border-orange-500/20 px-2 py-0.5 text-[10px] font-mono cursor-pointer transition-colors"
                          >
                            Link: {a}↔{b} ⨯
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={transmit}
                disabled={sending || !origin || !destination}
                className="mt-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-zinc-950 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                {sending ? "Beaming Laser..." : "Initiate Void Beam"}
              </button>
            </aside>

            {/* Simulation Dashboard Main */}
            <main className="flex flex-col gap-6">
              {(sendError || routingError) && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
                >
                  {sendError ?? routingError}
                </div>
              )}

              {pivotNotice && (
                <div
                  data-testid="pivot-notice"
                  role="status"
                  className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 shadow-lg animate-pulse"
                >
                  <span className="text-lg">⚡</span>
                  <span className="font-mono text-xs">{pivotNotice}</span>
                </div>
              )}

              {/* Planet Grid Visualization */}
              <SpaceMap
                nodes={universe.nodes}
                edges={universe.edges}
                origin={origin}
                destination={destination}
                deadNodes={deadNodes}
                deadLinks={deadLinks}
                route={result?.route ?? null}
                chosenPath={routingReport?.chosen_path ?? null}
                baselinePath={baselinePath}
                pathView={pathView}
                onPathViewChange={setPathView}
                linkEvaluations={routingReport?.link_evaluations ?? null}
                onSetOrigin={setOrigin}
                onSetDestination={setDestination}
                onToggleNode={toggleNode}
                onToggleLink={toggleLink}
              />

              {routingReport && (
                <div
                  data-testid="copilot-explanation"
                  className="rounded-2xl border border-cyan-500/20 bg-cyan-950/15 p-5 backdrop-blur-xl shadow-2xl"
                >
                  <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cyan-400/90">
                    Co-Pilot Explanation
                  </h2>
                  <p className="text-sm leading-relaxed text-zinc-300">
                    {routingReport.explanation}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-zinc-500">
                    Estimated latency:{" "}
                    <span className="text-cyan-300">
                      {routingReport.final_latency_estimate_ms.toFixed(1)} ms
                    </span>
                  </p>
                </div>
              )}

              {/* Phase 2 intelligence panels */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {routingReport ? (
                  <LinkEvaluationsPanel evaluations={routingReport.link_evaluations} />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/30 p-8 text-center">
                    <p className="text-xs text-zinc-500">
                      Run a Co-Pilot route to see per-link evaluations and decision
                      audit rows.
                    </p>
                  </div>
                )}
                <IntelligenceSummary />
              </div>

              {/* Telemetry Breakdown Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left: Latency gauges */}
                <LatencyMetrics
                  status={result?.packet.status ?? "pending"}
                  breakdown={result?.route.breakdown ?? null}
                  totalLatency={result?.route.total_latency_ms ?? 0}
                  undeliverableReason={result?.route.reason}
                />

                {/* Right: Codecs translator */}
                <CodexTerminal hopLog={result?.packet.hop_log ?? []} />
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
