/**
 * Public surface of the Chimera Co-Pilot module.
 *
 * This barrel re-exports the types and functions that external code (API
 * routes, dashboard, tests) should consume. Internal implementation details
 * in subdirectories are NOT re-exported here.
 */

// Shared types (also available from src/lib/relic/types.ts)
export type {
  InterplanetaryLink,
  ChimeraLinkState,
  LinkEvaluation,
  Phase2RoutingReport,
} from "./types";

// Link ID helper
export { canonicalLinkId } from "./link-id";

// Phase 2 entry point — Co-Pilot agent (Inusha)
export { routeWithCopilot } from "./agent/copilot";

// True Cost router (Inusha)
export { routeWithTrueCost } from "./router/true-cost-router";

// Chimera API client (Inusha)
export { ChimeraClient, chimeraClient, getLastChimeraTick } from "./client";
export type { ChimeraLinksResponse, ChimeraStateResponse } from "./client";

// Analytical sub-model runtime APIs (Ruwan)
export { predictCongestion } from "./models/congestion";
export type { CongestionResult } from "./models/congestion";
export { scoreTrust } from "./models/trust";
export { scoreTargetingRisk } from "./models/targeting";

// NL Parser (Inusha)
export { parseRoutingRequest } from "./parser/hybrid";
export type { StructuredIntent, ParseOptions } from "./parser/hybrid";
export {
  createOllamaParser,
  createGeminiParser,
  resolveConfiguredLlm,
} from "./parser/llm";
export type { LlmParseFn } from "./parser/llm";
