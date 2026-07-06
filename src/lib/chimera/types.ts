/**
 * Chimera module type re-exports.
 *
 * Phase 2 domain types are defined in `src/lib/relic/types.ts` (the canonical
 * location shared with the Phase 1 baseline layer). This barrel file re-exports
 * everything Chimera-specific so that code inside `src/lib/chimera/**` can
 * import from a single, short path without coupling to the relic internals.
 */

export type {
  InterplanetaryLink,
  ChimeraLinkState,
  LinkEvaluation,
  Phase2RoutingReport,
} from "../relic/types";

export { canonicalLinkId } from "./link-id";
