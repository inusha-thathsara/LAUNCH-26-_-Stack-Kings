"use client";

import { useEffect, useMemo, useState } from "react";

import type { VoidEdge } from "@/lib/relic/graph";
import type { TransmissionResult } from "@/lib/relic/transmission";
import type { PlanetNode, UniverseMetadata } from "@/lib/relic/types";

interface UniverseResponse {
  metadata: UniverseMetadata;
  nodes: PlanetNode[];
  adjacency: Record<string, string[]>;
  edges: VoidEdge[];
}

function ms(value: number): string {
  return `${value.toFixed(3)} ms`;
}

export default function RelicConsole() {
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

  const route = result?.route;
  const breakdown = route?.breakdown;
  const delivered = result?.packet.status === "delivered";

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-10 font-sans text-zinc-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <span className="text-sm font-medium uppercase tracking-widest text-emerald-400">
            Relic Ring Protocol
          </span>
          <h1 className="text-3xl font-bold tracking-tight">
            {universe?.metadata.system_name ?? "Zeta-26"} Routing Console
          </h1>
          <p className="text-sm text-zinc-400">
            Initialize the universe, trace a multi-hop packet, inspect the
            latency breakdown, and kill nodes/links to watch dynamic rerouting.
          </p>
        </header>

        {loadError && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {loadError}
          </p>
        )}

        {universe && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            <section className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase text-zinc-400">
                  Origin
                </label>
                <select
                  className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                >
                  {universe.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.id} (base {node.codex})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase text-zinc-400">
                  Destination
                </label>
                <select
                  className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  {universe.nodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.id} (base {node.codex})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase text-zinc-400">
                  Payload
                </label>
                <input
                  className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase text-zinc-400">
                  Chaos: kill planets
                </span>
                <div className="flex flex-wrap gap-2">
                  {universe.nodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => toggleNode(node.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        deadNodes.has(node.id)
                          ? "border-red-500 bg-red-500/20 text-red-300 line-through"
                          : "border-white/15 text-zinc-300 hover:border-white/40"
                      }`}
                    >
                      {node.id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase text-zinc-400">
                  Chaos: sever links
                </span>
                <div className="flex max-h-40 flex-col gap-1 overflow-auto pr-1">
                  {reachableEdges.map((edge) => {
                    const key = linkKey(edge.from, edge.to);
                    const dead = deadLinks.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleLink(edge.from, edge.to)}
                        className={`flex items-center justify-between rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          dead
                            ? "border-red-500 bg-red-500/20 text-red-300 line-through"
                            : "border-white/10 text-zinc-400 hover:border-white/30"
                        }`}
                      >
                        <span>
                          {edge.from} &harr; {edge.to}
                        </span>
                        <span className="text-zinc-500">
                          {(edge.void_distance_km / 1_000_000).toFixed(2)}M km
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={transmit}
                disabled={sending || !origin || !destination}
                className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Transmitting..." : "Transmit packet"}
              </button>
            </section>

            <section className="flex flex-col gap-5">
              {sendError && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {sendError}
                </p>
              )}

              {!result && !sendError && (
                <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border border-dashed border-white/10 text-sm text-zinc-500">
                  Configure a route and transmit to see the packet trace.
                </div>
              )}

              {result && route && (
                <>
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                        delivered
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {result.packet.status}
                    </span>
                    {delivered ? (
                      <>
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          {route.path.map((id, index) => (
                            <span key={`${id}-${index}`} className="flex items-center gap-1.5">
                              <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-medium">
                                {id}
                              </span>
                              {index < route.path.length - 1 && (
                                <span className="text-zinc-500">&rarr;</span>
                              )}
                            </span>
                          ))}
                        </div>
                        <span className="ml-auto text-sm text-zinc-400">
                          Total: <strong className="text-zinc-100">{ms(route.total_latency_ms)}</strong>
                        </span>
                      </>
                    ) : (
                      <span className="text-sm text-red-300">{route.reason}</span>
                    )}
                  </div>

                  {delivered && breakdown && (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        { label: "Fiber", value: breakdown.fiber_ms },
                        { label: "Towers", value: breakdown.tower_ms },
                        { label: "Atmosphere", value: breakdown.atmosphere_ms },
                        { label: "Void", value: breakdown.void_ms },
                      ].map((comp) => (
                        <div
                          key={comp.label}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="text-xs uppercase text-zinc-400">
                            {comp.label}
                          </div>
                          <div className="mt-1 text-sm font-semibold">
                            {ms(comp.value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {delivered && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                      <span className="text-zinc-400">Delivered payload: </span>
                      <span className="font-mono text-emerald-300">
                        {JSON.stringify(result.delivered_payload)}
                      </span>
                    </div>
                  )}

                  {delivered && (
                    <div className="overflow-auto rounded-2xl border border-white/10">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="bg-white/5 text-zinc-400">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Planet</th>
                            <th className="px-3 py-2">Codex</th>
                            <th className="px-3 py-2">Tower in&rarr;out</th>
                            <th className="px-3 py-2">Seg / Hit</th>
                            <th className="px-3 py-2">Tp</th>
                            <th className="px-3 py-2">Tv</th>
                            <th className="px-3 py-2">Cumulative</th>
                            <th className="px-3 py-2">Dialect</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.packet.hop_log.map((hop) => (
                            <tr key={hop.sequence} className="border-t border-white/5">
                              <td className="px-3 py-2 text-zinc-500">{hop.sequence}</td>
                              <td className="px-3 py-2 font-medium">{hop.planet_id}</td>
                              <td className="px-3 py-2">{hop.codex}</td>
                              <td className="px-3 py-2">
                                {hop.entry_tower} &rarr; {hop.exit_tower}
                              </td>
                              <td className="px-3 py-2">
                                {hop.segments} / {hop.towers_hit}
                              </td>
                              <td className="px-3 py-2">{hop.internal_latency_ms.toFixed(3)}</td>
                              <td className="px-3 py-2">
                                {hop.void_latency_ms !== undefined
                                  ? hop.void_latency_ms.toFixed(3)
                                  : "\u2014"}
                              </td>
                              <td className="px-3 py-2">{hop.cumulative_latency_ms.toFixed(3)}</td>
                              <td className="px-3 py-2 font-mono text-zinc-400">
                                [{hop.payload_dialect.digits.join(", ")}]
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
