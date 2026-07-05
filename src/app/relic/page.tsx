import DashboardErrorBoundary from "@/components/observability/DashboardErrorBoundary";
import RelicDashboard from "@/components/telemetry/RelicDashboard";

export default function RelicConsole() {
  return (
    <DashboardErrorBoundary>
      <RelicDashboard />
    </DashboardErrorBoundary>
  );
}
