import { publicMetadata } from "../../lib/seo";
import RoutesPage from "../../components/routes/RoutesPage";

export const metadata = publicMetadata("/routes");

export default function RoutesRoute() {
  return <RoutesPage />;
}
