import { Suspense } from "react";

import DashboardErrorBoundary from "@/components/observability/DashboardErrorBoundary";
import SentryClientDebugTrigger from "@/components/observability/SentryClientDebugTrigger";
import RelicDashboard from "@/components/telemetry/RelicDashboard";
import { APP_VERSION } from "@/lib/version";

export const metadata = {
  title: "Telemetry Console",
};

export default function RelicConsole() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={null}>
        <SentryClientDebugTrigger />
      </Suspense>
      <RelicDashboard appVersion={APP_VERSION} />
    </DashboardErrorBoundary>
  );
}
