"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanetNode, UniverseMetadata } from "@/lib/relic/types";
import type { VoidEdge } from "@/lib/relic/graph";
import type { TransmissionResult } from "@/lib/relic/transmission";
import SpaceMap from "./SpaceMap";
import CodexTerminal from "./CodexTerminal";
import LatencyMetrics from "./LatencyMetrics";

interface UniverseResponse {
  metadata: UniverseMetadata;
  nodes: PlanetNode[];
  adjacency: Record<string, string[]>;
  edges: VoidEdge[];
}

export default function RelicDashboard() {
  const [universe, setUniverse] = useState<UniverseResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [payload, setPayload] = useState("Hello world");
  const [deadNodes, setDeadNodes] = useState<Set<string>>(new Set());
  const [deadLinks, setDeadLinks] = useState<Set<string>>(new Set());

  const [result, setResult] = useState<TransmissionResult | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
          setOrigin(data.nodes[0].id);
          setDestination(data.nodes[data.nodes.length - 1].id);
        }
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : "Unknown error");
      });
  }, []);

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

  // Pre-configured Scenarios
  function applyScenario(scenario: string) {
    resetChaos();
    if (!universe) return;

    switch (scenario) {
      case "baseline":
        // All clear
        break;
      case "hyperflare":
        // Sever direct links Aegis-Boreas and Dawn-Elysium
        setDeadLinks(new Set([linkKey("Aegis", "Boreas"), linkKey("Dawn", "Elysium")]));
        break;
      case "distortion":
        // Dawn planet atmosphere goes hyper-refractive, routing goes down (planet offline)
        setDeadNodes(new Set(["Dawn"]));
        break;
      case "blackout":
        // Elysium & Dawn go completely offline
        setDeadNodes(new Set(["Elysium", "Dawn"]));
        break;
      case "chaos":
        // Randomly sever 2-3 links and kill 1 planet
        if (universe.nodes.length > 2) {
          const randomPlanet = universe.nodes[Math.floor(Math.random() * (universe.nodes.length - 2)) + 1].id;
          setDeadNodes(new Set([randomPlanet]));
        }
        const randomLinks = new Set<string>();
        for (let i = 0; i < 2; i++) {
          if (reachableEdges.length > 0) {
            const edge = reachableEdges[Math.floor(Math.random() * reachableEdges.length)];
            randomLinks.add(linkKey(edge.from, edge.to));
          }
        }
        setDeadLinks(randomLinks);
        break;
    }
  }

  async function transmit() {
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
  }

  // Automatic trigger on config changes to give a real-time reactive simulation experience!
  useEffect(() => {
    if (origin && destination && payload && universe) {
      transmit();
    }
  }, [origin, destination, deadNodes, deadLinks, universe]);

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
              <span className="text-[10px] font-mono text-zinc-500">
                VER 4.2.9 // PROT-STABLE
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
                  {(universe.metadata.max_void_hop_distance_km / 1_000_000).toFixed(0)}M km
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
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Error loading Zeta-26 universe map: {loadError}
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
                  <label className="text-[10px] font-medium uppercase text-zinc-500">
                    Origin Terminal
                  </label>
                  <select
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 transition-all"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                  >
                    {universe.nodes.map((node) => (
                      <option key={node.id} value={node.id} disabled={deadNodes.has(node.id)}>
                        {node.id} {deadNodes.has(node.id) ? " (OFFLINE)" : `(base ${node.codex})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-medium uppercase text-zinc-500">
                    Destination Terminal
                  </label>
                  <select
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 transition-all"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  >
                    {universe.nodes.map((node) => (
                      <option key={node.id} value={node.id} disabled={deadNodes.has(node.id)}>
                        {node.id} {deadNodes.has(node.id) ? " (OFFLINE)" : `(base ${node.codex})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-medium uppercase text-zinc-500">
                    Payload Message
                  </label>
                  <input
                    className="rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 transition-all font-mono"
                    value={payload}
                    onChange={(e) => setPayload(e.target.value)}
                    placeholder="Enter payload..."
                  />
                </div>
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
                    <span className="text-[10px] text-zinc-500 italic">No network faults detected. All systems green.</span>
                  ) : (
                    <>
                      {[...deadNodes].map((nodeId) => (
                        <span
                          key={nodeId}
                          onClick={() => toggleNode(nodeId)}
                          className="rounded bg-red-950/40 hover:bg-red-950 text-red-400 border border-red-500/20 px-2 py-0.5 text-[10px] font-mono cursor-pointer transition-colors"
                        >
                          Node: {nodeId} ⨯
                        </span>
                      ))}
                      {[...deadLinks].map((key) => {
                        const [a, b] = key.split("|");
                        return (
                          <span
                            key={key}
                            onClick={() => toggleLink(a, b)}
                            className="rounded bg-orange-950/40 hover:bg-orange-950 text-orange-400 border border-orange-500/20 px-2 py-0.5 text-[10px] font-mono cursor-pointer transition-colors"
                          >
                            Link: {a}↔{b} ⨯
                          </span>
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
              {sendError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {sendError}
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
                onSetOrigin={setOrigin}
                onSetDestination={setDestination}
                onToggleNode={toggleNode}
                onToggleLink={toggleLink}
              />

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
                <CodexTerminal
                  hopLog={result?.packet.hop_log ?? []}
                  payload={payload}
                />
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
