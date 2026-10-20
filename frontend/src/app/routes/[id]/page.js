import { publicMetadata } from "../../../lib/seo";
import RouteDetailsRouteClient from "../../../components/route/RouteDetailsRouteClient";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return publicMetadata("/routes/" + encodeURIComponent(id), ["Route Details | Smart Safar", "Explore available stops, road geometry and buses assigned to this Faisalabad route."]);
}

export default async function RouteDetailsRoute({ params }) {
  const { id } = await params;
  return <RouteDetailsRouteClient routeId={id} />;
}
