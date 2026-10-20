import { publicMetadata } from "../../lib/seo";
import LiveMapRouteClient from "../../components/live-map/LiveMapRouteClient";

export const metadata = publicMetadata("/live-map");

export default function LiveMapRoute() {
  return <LiveMapRouteClient />;
}
