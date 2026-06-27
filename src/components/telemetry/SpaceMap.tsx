"use client";

import { useMemo, useState } from "react";
import type { PlanetNode } from "@/lib/relic/types";
import type { VoidEdge } from "@/lib/relic/graph";
import type { Route } from "@/lib/relic/router";

interface SpaceMapProps {
  nodes: PlanetNode[];
  edges: VoidEdge[];
  origin: string;
  destination: string;
  deadNodes: Set<string>;
  deadLinks: Set<string>;
  route: Route | null;
  onSetOrigin: (id: string) => void;
  onSetDestination: (id: string) => void;
  onToggleNode: (id: string) => void;
  onToggleLink: (a: string, b: string) => void;
}

export default function SpaceMap({
  nodes,
  edges,
  origin,
  destination,
  deadNodes,
  deadLinks,
  route,
  onSetOrigin,
  onSetDestination,
  onToggleNode,
  onToggleLink,
}: SpaceMapProps) {
  const [hoveredPlanet, setHoveredPlanet] = useState<PlanetNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Map limits
  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (nodes.length === 0) {
      return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    }
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const node of nodes) {
      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
    }
    return { minX, maxX, minY, maxY };
  }, [nodes]);

  const width = 800;
  const height = 500;
  const padding = 70;

  // Calculate coordinates with scaling and centered aspect ratio
  const { scaleX, scaleY } = useMemo(() => {
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const maxRange = Math.max(rangeX, rangeY);

    const scale = (width - 2 * padding) / maxRange;
    const offsetX = (width - rangeX * scale) / 2;
    const offsetY = (height - rangeY * scale) / 2;

    return {
      scaleX: (x: number) => offsetX + (x - minX) * scale,
      scaleY: (y: number) => height - offsetY - (y - minY) * scale, // Flip Y to keep positive Y up
    };
  }, [minX, maxX, minY, maxY]);

  // Logarithmic visual size to avoid Caelum dwarfing others
  const getVisualRadius = (radiusKm: number) => {
    return 16 + Math.sqrt(radiusKm) * 0.08;
  };

  const getTowerPos = (planet: PlanetNode, towerIndex: number, vr: number) => {
    const total = planet.active_towers;
    const angleDeg = (towerIndex * 360) / total;
    const angleRad = (angleDeg * Math.PI) / 180;
    const sx = scaleX(planet.x);
    const sy = scaleY(planet.y);
    return {
      x: sx + vr * Math.sin(angleRad),
      y: sy - vr * Math.cos(angleRad),
    };
  };

  function linkKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  // Build the complete packet travel path for animation
  const animationPathD = useMemo(() => {
    if (!route || !route.deliverable || route.path.length < 2) return "";
    let d = "";

    // Start from the first step exit tower
    const startStep = route.steps[0];
    const startPlanet = nodes.find((n) => n.id === startStep.planet_id);
    if (!startPlanet) return "";
    
    const vrStart = getVisualRadius(startPlanet.radius_km);
    const startPos = getTowerPos(startPlanet, startStep.exit_tower, vrStart);
    d += `M ${startPos.x} ${startPos.y}`;

    for (let i = 0; i < route.hops.length; i += 1) {
      const hop = route.hops[i];
      const nextStep = route.steps[i + 1];
      const fromPlanet = nodes.find((n) => n.id === hop.from);
      const toPlanet = nodes.find((n) => n.id === hop.to);
      if (!fromPlanet || !toPlanet) continue;

      // 1. Line to receiving tower on next planet
      const vrTo = getVisualRadius(toPlanet.radius_km);
      const toPos = getTowerPos(toPlanet, hop.destination_tower, vrTo);
      d += ` L ${toPos.x} ${toPos.y}`;

      // 2. Arc along next planet's fiber ring to next exit tower
      const nextExitPos = getTowerPos(toPlanet, nextStep.exit_tower, vrTo);
      const entryTower = nextStep.entry_tower;
      const exitTower = nextStep.exit_tower;
      const totalTowers = toPlanet.active_towers;

      if (entryTower !== exitTower) {
        const angle1 = (entryTower * 360) / totalTowers;
        const angle2 = (exitTower * 360) / totalTowers;
        
        let diff = angle2 - angle1;
        while (diff < -180) diff += 360;
        while (diff > 180) diff -= 360;
        
        const sweepFlag = diff >= 0 ? 1 : 0;
        d += ` A ${vrTo} ${vrTo} 0 0 ${sweepFlag} ${nextExitPos.x} ${nextExitPos.y}`;
      }
    }
    return d;
  }, [route, nodes]);

  // Determine if a link is part of the active route
  const activeHopsKeys = useMemo(() => {
    const keys = new Set<string>();
    if (route && route.deliverable) {
      for (const hop of route.hops) {
        keys.add(linkKey(hop.from, hop.to));
      }
    }
    return keys;
  }, [route]);

  return (
    <div className="relative select-none rounded-2xl border border-white/10 bg-zinc-900/60 p-4 backdrop-blur-xl shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400"></span>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Quantum Radar Display
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-600">
          GRID RANGE: [{minX}, {minY}] to [{maxX}, {maxY}]
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/5 bg-zinc-950/80">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[500px]"
        >
          {/* Grid Background */}
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="rgba(255, 255, 255, 0.02)"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="nebula" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.05)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0)" />
            </radialGradient>
          </defs>
          <rect width={width} height={height} fill="url(#grid)" />
          <circle cx={width / 2} cy={height / 2} r={280} fill="url(#nebula)" />

          {/* 1. Draw all connections / links first (underneath planets) */}
          {edges
            .filter((edge) => edge.within_lmax)
            .map((edge) => {
              const nodeA = nodes.find((n) => n.id === edge.from);
              const nodeB = nodes.find((n) => n.id === edge.to);
              if (!nodeA || !nodeB) return null;

              const x1 = scaleX(nodeA.x);
              const y1 = scaleY(nodeA.y);
              const x2 = scaleX(nodeB.x);
              const y2 = scaleY(nodeB.y);

              const key = linkKey(edge.from, edge.to);
              const isDead = deadLinks.has(key) || deadNodes.has(edge.from) || deadNodes.has(edge.to);
              const isActive = activeHopsKeys.has(key);

              return (
                <g key={key}>
                  {/* Interactive invisible thick hit area */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="transparent"
                    strokeWidth="12"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLink(edge.from, edge.to);
                    }}
                  />
                  {/* Visible link */}
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={
                      isDead
                        ? "rgba(239, 68, 68, 0.4)"
                        : isActive
                        ? "#10b981"
                        : "rgba(255, 255, 255, 0.15)"
                    }
                    strokeWidth={isActive ? "2" : "1.5"}
                    strokeDasharray={isDead ? "4, 4" : "none"}
                    className="transition-all duration-300"
                  />
                </g>
              );
            })}

          {/* 2. Draw active route overlay beam (underneath planet circles, but above inactive edges) */}
          {route && route.deliverable && animationPathD && (
            <g>
              {/* Backlight path */}
              <path
                d={animationPathD}
                fill="none"
                stroke="rgba(16, 185, 129, 0.3)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="blur-sm"
              />
              {/* Core laser path */}
              <path
                d={animationPathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Animated packet pulse */}
              <circle r="5" fill="#34d399" className="filter drop-shadow-[0_0_6px_#10b981]">
                <animateMotion
                  dur="4s"
                  repeatCount="indefinite"
                  path={animationPathD}
                />
              </circle>
            </g>
          )}

          {/* 3. Draw Planets */}
          {nodes.map((node) => {
            const sx = scaleX(node.x);
            const sy = scaleY(node.y);
            const vr = getVisualRadius(node.radius_km);
            const isDead = deadNodes.has(node.id);
            const isOrigin = origin === node.id;
            const isDestination = destination === node.id;
            const isInRoute = route?.path.includes(node.id) ?? false;

            // Compute atmosphere thickness visually
            const atmosWidth = Math.max(5, node.atmosphere_thickness_km * 0.03);

            return (
              <g
                key={node.id}
                className="group cursor-pointer"
                onMouseEnter={(e) => {
                  setHoveredPlanet(node);
                  setTooltipPos({ x: sx, y: sy - vr - 20 });
                }}
                onMouseLeave={() => setHoveredPlanet(null)}
                onClick={() => onToggleNode(node.id)}
              >
                {/* 3a. Atmosphere / Glow */}
                <circle
                  cx={sx}
                  cy={sy}
                  r={vr + atmosWidth}
                  fill="none"
                  stroke={
                    isDead
                      ? "rgba(239, 68, 68, 0.1)"
                      : isOrigin
                      ? "rgba(59, 130, 246, 0.25)"
                      : isDestination
                      ? "rgba(168, 85, 247, 0.25)"
                      : isInRoute
                      ? "rgba(16, 185, 129, 0.25)"
                      : "rgba(255, 255, 255, 0.04)"
                  }
                  strokeWidth="2.5"
                  className="transition-all duration-300"
                />

                {/* 3b. Equatorial fiber ring (dashed orbit) */}
                <circle
                  cx={sx}
                  cy={sy}
                  r={vr}
                  fill="none"
                  stroke={
                    isDead
                      ? "rgba(239, 68, 68, 0.2)"
                      : isInRoute
                      ? "rgba(16, 185, 129, 0.5)"
                      : "rgba(255, 255, 255, 0.12)"
                  }
                  strokeWidth="1"
                  strokeDasharray="3, 3"
                  className="transition-all duration-300"
                />

                {/* 3c. Planet base circle */}
                <circle
                  cx={sx}
                  cy={sy}
                  r={vr}
                  fill={
                    isDead
                      ? "#180808"
                      : isOrigin
                      ? "url(#originGrad)"
                      : isDestination
                      ? "url(#destGrad)"
                      : "url(#planetGrad)"
                  }
                  stroke={
                    isDead
                      ? "#ef4444"
                      : isOrigin
                      ? "#3b82f6"
                      : isDestination
                      ? "#a855f7"
                      : isInRoute
                      ? "#10b981"
                      : "rgba(255, 255, 255, 0.3)"
                  }
                  strokeWidth={isOrigin || isDestination || isInRoute ? "2.5" : "1.5"}
                  className="transition-all duration-300 group-hover:stroke-white/80"
                />

                {/* Gradient Definitions per node type */}
                <defs>
                  <radialGradient id="planetGrad" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#27272a" />
                    <stop offset="100%" stopColor="#09090b" />
                  </radialGradient>
                  <radialGradient id="originGrad" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#1e3a8a" />
                    <stop offset="100%" stopColor="#1e1b4b" />
                  </radialGradient>
                  <radialGradient id="destGrad" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#581c87" />
                    <stop offset="100%" stopColor="#2e1065" />
                  </radialGradient>
                </defs>

                {/* 3d. Active towers on the equatorial ring */}
                {!isDead &&
                  Array.from({ length: node.active_towers }).map((_, idx) => {
                    const pos = getTowerPos(node, idx, vr);
                    // Check if this tower is currently highlighted in the path
                    let isTowerActive = false;
                    if (route && route.deliverable) {
                      const step = route.steps.find((s) => s.planet_id === node.id);
                      if (step) {
                        // Check if packet goes through this tower
                        isTowerActive =
                          step.entry_tower === idx || step.exit_tower === idx;
                      }
                    }

                    return (
                      <circle
                        key={idx}
                        cx={pos.x}
                        cy={pos.y}
                        r={isTowerActive ? "2.5" : "1.5"}
                        fill={isTowerActive ? "#10b981" : "rgba(255, 255, 255, 0.6)"}
                        className="transition-all duration-300"
                      >
                        <title>{`Tower ${idx}`}</title>
                      </circle>
                    );
                  })}

                {/* 3e. Text Label */}
                <text
                  x={sx}
                  y={sy + vr + 16}
                  textAnchor="middle"
                  className={`text-[10px] font-bold tracking-wide select-none ${
                    isDead
                      ? "fill-red-400 line-through"
                      : isOrigin
                      ? "fill-blue-400"
                      : isDestination
                      ? "fill-purple-400"
                      : "fill-zinc-300"
                  }`}
                >
                  {node.id}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Float details panel on hover */}
        {hoveredPlanet && (
          <div
            className="absolute z-20 w-56 rounded-xl border border-white/10 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-md transition-opacity pointer-events-auto"
            style={{
              left: `${Math.min(width - 240, Math.max(10, tooltipPos.x - 112))}px`,
              top: `${Math.max(10, tooltipPos.y - 120)}px`,
            }}
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5">
              <span className={`text-xs font-bold ${deadNodes.has(hoveredPlanet.id) ? "text-red-400 line-through" : "text-white"}`}>
                {hoveredPlanet.id}
              </span>
              <span className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-[9px] text-zinc-400">
                BASE {hoveredPlanet.codex}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-zinc-400 font-mono">
              <span>Radius:</span>
              <span className="text-right text-zinc-200">
                {hoveredPlanet.radius_km.toLocaleString()} km
              </span>
              <span>Atmos Shell:</span>
              <span className="text-right text-zinc-200">
                {hoveredPlanet.atmosphere_thickness_km} km
              </span>
              <span>Refraction Index:</span>
              <span className="text-right text-zinc-200">
                {hoveredPlanet.refraction_index.toFixed(4)}
              </span>
              <span>Active Towers:</span>
              <span className="text-right text-zinc-200">
                {hoveredPlanet.active_towers}
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetOrigin(hoveredPlanet.id);
                }}
                disabled={deadNodes.has(hoveredPlanet.id)}
                className="flex-1 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-[9px] font-bold text-white py-1 px-1.5 transition-colors cursor-pointer text-center"
              >
                Set Origin
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetDestination(hoveredPlanet.id);
                }}
                disabled={deadNodes.has(hoveredPlanet.id)}
                className="flex-1 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-purple-600 text-[9px] font-bold text-white py-1 px-1.5 transition-colors cursor-pointer text-center"
              >
                Set Dest
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-blue-500 bg-blue-950"></span>
          <span>Origin</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-purple-500 bg-purple-950"></span>
          <span>Destination</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-emerald-500 bg-emerald-950"></span>
          <span>Active Route Nodes</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border border-red-500 bg-red-950/40 line-through"></span>
          <span>Offline/Chaos Node</span>
        </div>
        <div className="ml-auto text-[10px] text-zinc-500">
          💡 Click a planet to toggle offline. Drag not supported.
        </div>
      </div>
    </div>
  );
}
