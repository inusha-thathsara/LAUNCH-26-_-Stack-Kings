"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [universe, setUniverse] = useState(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [payload, setPayload] = useState("Hello world");
  const [result, setResult] = useState(null);

  async function loadUniverse() {
    const res = await fetch("/api/universe");
    const data = await res.json();
    setUniverse(data);

    if (data.nodes?.length >= 2) {
      setOrigin(data.nodes[0].id);
      setDestination(data.nodes[data.nodes.length - 1].id);
    }
  }

  useEffect(() => {
    loadUniverse();
  }, []);

  async function sendPacket() {
    const res = await fetch("/api/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin_id: origin,
        destination_id: destination,
        payload,
      }),
    });

    const data = await res.json();
    setResult(data);
    await loadUniverse();
  }

  async function chaos(action, body = {}) {
    await fetch("/api/chaos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...body }),
    });

    await loadUniverse();
  }

  if (!universe) {
    return <main className="min-h-screen bg-slate-950 text-white p-8">Loading universe...</main>;
  }

  const route = result?.packet?.route || [];

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-4xl font-bold text-cyan-300 mb-2">
        RelicOps Control Center
      </h1>

      <p className="text-slate-300 mb-6">
        Zeta-26 message routing simulator for The Relic Ring Protocol.
      </p>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-cyan-800 rounded-xl p-5">
          <h2 className="text-xl font-bold text-green-300 mb-4">
            Send Packet
          </h2>

          <label className="block mb-2">Origin</label>
          <select
            className="w-full text-black p-2 rounded mb-4"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          >
            {universe.nodes.map((node) => (
              <option key={node.id}>{node.id}</option>
            ))}
          </select>

          <label className="block mb-2">Destination</label>
          <select
            className="w-full text-black p-2 rounded mb-4"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            {universe.nodes.map((node) => (
              <option key={node.id}>{node.id}</option>
            ))}
          </select>

          <label className="block mb-2">Payload</label>
          <textarea
            className="w-full text-black p-2 rounded mb-4"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />

          <button
            onClick={sendPacket}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 rounded"
          >
            Send Packet
          </button>

          <div className="mt-6">
            <h3 className="text-red-300 font-bold mb-2">Chaos Panel</h3>

            <select
              className="w-full text-black p-2 rounded mb-2"
              onChange={(e) => setOrigin(e.target.value)}
              value={origin}
            >
              {universe.nodes.map((node) => (
                <option key={node.id}>{node.id}</option>
              ))}
            </select>

            <button
              onClick={() => chaos("kill-node", { node_id: origin })}
              className="w-full bg-red-600 hover:bg-red-500 py-2 rounded mb-2"
            >
              Kill Selected Origin Node
            </button>

            <button
              onClick={() => chaos("kill-link", { from: origin, to: destination })}
              className="w-full bg-orange-600 hover:bg-orange-500 py-2 rounded mb-2"
            >
              Kill Origin-Destination Link
            </button>

            <button
              onClick={() => chaos("restore-all")}
              className="w-full bg-green-600 hover:bg-green-500 py-2 rounded"
            >
              Restore All
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-cyan-800 rounded-xl p-5 lg:col-span-2">
          <h2 className="text-xl font-bold text-cyan-300 mb-4">
            Universe Map
          </h2>

          <svg viewBox="-80 -180 820 620" className="w-full h-[420px] bg-black rounded-xl border border-slate-700">
            {Object.entries(universe.graph).map(([from, edges]) =>
              edges.map((edge) => {
                const a = universe.nodes.find((n) => n.id === from);
                const b = universe.nodes.find((n) => n.id === edge.to);

                const active =
                  route.includes(a.id) &&
                  route.includes(b.id) &&
                  Math.abs(route.indexOf(a.id) - route.indexOf(b.id)) === 1;

                return (
                  <line
                    key={`${from}-${edge.to}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={active ? "#22c55e" : "#475569"}
                    strokeWidth={active ? 5 : 1}
                  />
                );
              })
            )}

            {universe.nodes.map((node) => {
              const isDead = universe.chaos.deadNodes.includes(node.id);
              const isInRoute = route.includes(node.id);

              return (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isInRoute ? 18 : 13}
                    fill={isDead ? "#dc2626" : isInRoute ? "#22c55e" : "#38bdf8"}
                  />
                  <text
                    x={node.x + 18}
                    y={node.y + 5}
                    fill="white"
                    fontSize="16"
                  >
                    {node.id} B{node.codex}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="mt-4">
            <h3 className="font-bold text-yellow-300">Route</h3>
            <p className="text-lg">
              {route.length > 0 ? route.join(" → ") : "No packet sent yet"}
            </p>
          </div>
        </div>
      </section>

      {result && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-slate-900 border border-green-800 rounded-xl p-5">
            <h2 className="text-xl font-bold text-green-300 mb-4">
              Latency Breakdown
            </h2>

            {result.deliverable ? (
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Fiber Time" value={result.latency_breakdown.totalFiberSeconds} />
                  <Row label="Tower Delay" value={result.latency_breakdown.totalTowerSeconds} />
                  <Row label="Void Time" value={result.latency_breakdown.totalVoidSeconds} />
                  <Row label="Internal Time" value={result.latency_breakdown.totalInternalSeconds} />
                  <Row label="Total Latency" value={result.latency_breakdown.totalLatencySeconds} bold />
                </tbody>
              </table>
            ) : (
              <p className="text-red-300">{result.reason}</p>
            )}
          </div>

          <div className="bg-slate-900 border border-purple-800 rounded-xl p-5">
            <h2 className="text-xl font-bold text-purple-300 mb-4">
              Hop Log / Packet JSON
            </h2>

            <pre className="text-xs bg-black p-4 rounded overflow-auto max-h-[500px]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </section>
      )}
    </main>
  );
}

function Row({ label, value, bold }) {
  return (
    <tr className={bold ? "text-yellow-300 font-bold" : ""}>
      <td className="border border-slate-700 p-2">{label}</td>
      <td className="border border-slate-700 p-2">
        {Number(value).toFixed(6)} seconds
      </td>
    </tr>
  );
}