import { Suspense } from "react";

import DashboardErrorBoundary from "@/components/observability/DashboardErrorBoundary";
import SentryClientDebugTrigger from "@/components/observability/SentryClientDebugTrigger";
import RelicDashboard from "@/components/telemetry/RelicDashboard";

export default function RelicConsole() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={null}>
        <SentryClientDebugTrigger />
      </Suspense>
      <RelicDashboard />
    </DashboardErrorBoundary>
  );
}
