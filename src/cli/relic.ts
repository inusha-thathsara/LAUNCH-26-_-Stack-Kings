/**
 * Terminal demo for the Relic Ring Protocol (milestones M1-M4).
 *
 * Usage (via npm):
 *   npm run relic                 # scripted M1-M4 walkthrough
 *   npm run relic -- init         # M1: universe initialization
 *   npm run relic -- send A C "Hi" --kill B --cut A-D,B-C
 */

import { createEngine, type Engine } from "../lib/relic/engine";
import { loadUniverseConfig } from "../lib/relic/server/universe";
import { transmit, type TransmissionResult } from "../lib/relic/transmission";

function fmt(value: number): string {
  return value.toFixed(3);
}

function printUniverse(engine: Engine): void {
  console.log("== M1: Universe Initialization ==");
  console.log(`System: ${engine.universe.metadata.system_name}`);
  console.log(
    `Planets: ${engine.universe.nodes
      .map((n) => `${n.id}(base ${n.codex})`)
      .join(", ")}`,
  );
  console.log("Reachable links (L <= Lmax):");
  for (const edge of engine.graph.edges.filter((e) => e.within_lmax)) {
    console.log(
      `  ${edge.from} <-> ${edge.to}   L = ${(edge.void_distance_km / 1_000_000).toFixed(2)}M km`,
    );
  }
}

function printResult(label: string, result: TransmissionResult): void {
  console.log(`\n== ${label} ==`);
  const { packet, route, delivered_payload } = result;

  if (packet.status !== "delivered") {
    console.log(`UNDELIVERABLE: ${packet.undeliverable_reason ?? "unknown"}`);
    return;
  }

  console.log(`Route: ${route.path.join(" -> ")}`);
  console.log(`Total latency: ${fmt(route.total_latency_ms)} ms`);
  console.log(
    `Breakdown: fiber=${fmt(route.breakdown.fiber_ms)} tower=${fmt(
      route.breakdown.tower_ms,
    )} atmosphere=${fmt(route.breakdown.atmosphere_ms)} void=${fmt(
      route.breakdown.void_ms,
    )} (ms)`,
  );
  console.log(`Delivered payload: ${JSON.stringify(delivered_payload)}`);
  console.log("hop_log:");
  for (const hop of packet.hop_log) {
    const tv =
      hop.void_latency_ms !== undefined ? fmt(hop.void_latency_ms) : "-";
    console.log(
      `  [${hop.sequence}] ${hop.planet_id} base${hop.codex} ` +
        `tower ${hop.entry_tower}->${hop.exit_tower} s=${hop.segments} m=${hop.towers_hit} ` +
        `Tp=${fmt(hop.internal_latency_ms)} Tv=${tv} cum=${fmt(hop.cumulative_latency_ms)} ` +
        `dialect=[${hop.payload_dialect.digits.join(", ")}]`,
    );
  }
}

function parseList(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function parseEdges(value: string | undefined): Array<[string, string]> {
  return parseList(value).map((pair) => {
    const [a, b] = pair.split("-");
    return [a, b] as [string, string];
  });
}

function getFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function main(): void {
  const engine = createEngine(loadUniverseConfig());
  const argv = process.argv.slice(2);
  const command = argv[0] ?? "demo";

  if (command === "init") {
    printUniverse(engine);
    return;
  }

  if (command === "send") {
    const origin = argv[1];
    const destination = argv[2];
    const payload = argv[3] ?? "Hello world";
    if (!origin || !destination) {
      console.error(
        'usage: send <origin> <destination> [payload] [--kill A,B] [--cut A-B,C-D]',
      );
      process.exit(1);
    }
    const result = transmit(
      engine.universe,
      engine.geometry,
      engine.codec,
      origin,
      destination,
      payload,
      {
        blockedNodes: parseList(getFlag(argv, "--kill")),
        blockedEdges: parseEdges(getFlag(argv, "--cut")),
      },
    );
    printResult(`send ${origin} -> ${destination}`, result);
    return;
  }

  if (command === "demo") {
    printUniverse(engine);
    const nodes = engine.universe.nodes;
    const origin = nodes[0].id;
    const destination = nodes[nodes.length - 1].id;

    const first = engine.network.send(origin, destination, "Hello world");
    printResult(`M2/M3: ${origin} -> ${destination}`, first);

    const intermediate = first.route.path.slice(1, -1)[0];
    if (intermediate) {
      engine.network.killNode(intermediate);
      const rerouted = engine.network.send(origin, destination, "Hello world");
      printResult(`M4: chaos - killed ${intermediate}, rerouting`, rerouted);
      engine.network.reviveNode(intermediate);
    } else {
      console.log("\n(No intermediate node on this route to demonstrate M4.)");
    }
    return;
  }

  console.error(`Unknown command "${command}". Use: demo | init | send`);
  process.exit(1);
}

main();
