import { publicMetadata } from "../lib/seo";

import HomeRouteClient from "../components/home/HomeRouteClient";

export default function Home() {
  return <HomeRouteClient />;
}

export const metadata = publicMetadata("/");
