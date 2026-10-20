import { publicMetadata } from "../../../lib/seo";
import BusDetailsRouteClient from "../../../components/bus/BusDetailsRouteClient";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return publicMetadata("/buses/" + encodeURIComponent(id), ["Bus Details | Smart Safar", "View available GPS location, arrival estimates and service information for this bus."]);
}

export default async function BusDetailsRoute({ params }) {
  const { id } = await params;
  return <BusDetailsRouteClient busId={id} />;
}
