"use client";
import { useAuth } from "../../hooks/useAuth";
import HomePage from "./HomePage";
import CommuterHome from "./CommuterHome";
export default function HomeRouteClient() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <CommuterHome /> : <HomePage />;
}
