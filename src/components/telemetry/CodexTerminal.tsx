"use client";

import { useState } from "react";
import type { HopLogEntry } from "@/lib/relic/types";

interface CodexTerminalProps {
  hopLog: HopLogEntry[];
}

export default function CodexTerminal({ hopLog }: CodexTerminalProps) {
  const [selectedHopSeq, setSelectedHopSeq] = useState<number>(0);

  if (hopLog.length === 0) {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-zinc-900/20 text-center p-6 backdrop-blur-md">
        <span className="text-4xl">📡</span>
        <h3 className="mt-4 text-sm font-semibold text-zinc-300">Dialect Codex Decoder Offline</h3>
        <p className="mt-2 text-xs text-zinc-500 max-w-xs">
          Transmit a packet to initiate dialect conversion, byte serialization, and binary laser telemetry.
        </p>
      </div>
    );
  }

  // Ensure the selected hop index is valid
  const currentHop = hopLog.find((h) => h.sequence === selectedHopSeq) ?? hopLog[0];
  const isDestination = currentHop.next_hop_id === undefined;

  // Helper to convert character to printable form (space, etc.)
  const toPrintableChar = (ascii: number) => {
    if (ascii === 32) return "␣";
    return String.fromCharCode(ascii);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-amber-400"></span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
            Codex Dialect Terminal
          </h2>
        </div>
        <span className="font-mono text-[10px] text-zinc-400">
          HOPS: {hopLog.length} · BASE CONVERSIONS: {hopLog.length}
        </span>
      </div>

      {/* Hop Selector Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
        {hopLog.map((hop) => {
          const isActive = hop.sequence === selectedHopSeq;
          return (
            <button
              key={hop.sequence}
              type="button"
              onClick={() => setSelectedHopSeq(hop.sequence)}
              className={`flex shrink-0 flex-col items-start rounded-lg border px-3 py-1.5 text-left transition-all cursor-pointer ${
                isActive
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                  : "border-white/5 bg-zinc-950/40 text-zinc-400 hover:border-white/10 hover:bg-zinc-950/70"
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">
                Hop #{hop.sequence}
              </span>
              <span className="font-mono text-xs font-bold">
                {hop.planet_id} (b{hop.codex})
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Terminal Display */}
      <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-black/95 p-4 font-mono text-xs text-zinc-300">
        {/* Header Telemetry */}
        <div className="grid grid-cols-2 gap-2 border-b border-zinc-800 pb-3 text-[10px] text-zinc-500">
          <div>
            NODE IDENTIFIER: <span className="text-zinc-300">{currentHop.planet_id}</span>
          </div>
          <div className="text-right">
            LOCAL DIALECT: <span className="text-zinc-300">Base {currentHop.codex}</span>
          </div>
          <div>
            INTERNAL TRANSIT: <span className="text-zinc-300">{currentHop.entry_tower} &rarr; {currentHop.exit_tower} ({currentHop.segments} segs)</span>
          </div>
          <div className="text-right">
            NEXT HOP: <span className="text-zinc-300">
              {isDestination
                ? "FINAL DESTINATION"
                : `${currentHop.next_hop_id} (B-${currentHop.next_hop_codex})`}
            </span>
          </div>
        </div>

        {/* Character-by-Character Breakdown Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-1 pr-3 font-normal">CHAR</th>
                <th className="py-1 px-3 font-normal">ASCII</th>
                <th className="py-1 px-3 font-normal">LOCAL (B-{currentHop.codex})</th>
                <th className="py-1 pl-3 font-normal text-right">
                  {isDestination
                    ? "DECODED HERE"
                    : `→ NEXT HOP (B-${currentHop.next_hop_codex})`}
                </th>
              </tr>
            </thead>
            <tbody>
              {currentHop.payload_ascii.map((asciiVal, idx) => {
                const charStr = toPrintableChar(asciiVal);
                const localDigit = currentHop.payload_dialect.digits[idx] ?? "0";
                const nextDigit = currentHop.next_hop_dialect?.digits[idx];

                return (
                  <tr key={idx} className="border-b border-zinc-900/50 hover:bg-zinc-900/30">
                    <td className="py-1.5 pr-3 font-bold text-amber-400">{charStr}</td>
                    <td className="py-1.5 px-3 text-zinc-400">{asciiVal}</td>
                    <td className="py-1.5 px-3 text-emerald-400 font-semibold">{localDigit}</td>
                    <td className="py-1.5 pl-3 text-right font-mono font-semibold text-sky-400">
                      {isDestination ? toPrintableChar(asciiVal) : nextDigit ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Flat Binary Serialization Beam */}
        <div className="mt-2 flex flex-col gap-1.5 border-t border-zinc-800 pt-3">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {isDestination
              ? "Payload Decoded at Destination"
              : `Serialized Void Laser Stream → ${currentHop.next_hop_id} (Flat Binary, B-${currentHop.next_hop_codex})`}
          </span>
          <div className="relative overflow-hidden rounded-lg bg-zinc-950 p-2.5 text-[10px] leading-relaxed text-emerald-500/80 shadow-inner">
            {/* Visual glow overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 animate-pulse pointer-events-none"></div>
            <div className="break-all font-mono tracking-wider select-all select-none">
              {isDestination
                ? `✓ "${currentHop.payload_ascii.map(toPrintableChar).join("")}" recovered in local dialect (Base ${currentHop.codex})`
                : currentHop.binary_stream || "EMPTY_PAYLOAD_STREAM"}
            </div>
          </div>
        </div>

        {/* Hop Stats */}
        <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
          <span>TOWERS HIT: {currentHop.towers_hit}x (delay: {currentHop.internal_latency_ms.toFixed(1)}ms)</span>
          <span>VOID PROPAGATION: {currentHop.void_latency_ms !== undefined ? `${currentHop.void_latency_ms.toFixed(2)}ms` : "N/A"}</span>
          <span className="text-emerald-400 font-bold">CUMULATIVE: {currentHop.cumulative_latency_ms.toFixed(3)} ms</span>
        </div>
      </div>
    </div>
  );
}
