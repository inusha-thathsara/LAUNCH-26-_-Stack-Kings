import RelicDashboard from "@/components/telemetry/RelicDashboard";
import { APP_VERSION } from "@/lib/version";

export default function Home() {
  return <RelicDashboard appVersion={APP_VERSION} />;
}
