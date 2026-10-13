"use client";

import Link from "./SmartLink";
import { useEffect, useState } from "react";
import { getProfile } from "../../services/authService";
import { useAuth } from "../../hooks/useAuth";
import { hasRole, ROLES } from "../../lib/auth/permissions";
import { PageSkeleton } from "./SectionSkeleton";
import { useProfileContext } from "../../hooks/useProfileContext";
import { ErrorState } from "./ErrorState";
import { Button } from "./Button";

export function ProtectedPage({ children, adminOnly = false, driverOnly = false, fallback }) {
  const { token, isLoading } = useAuth();
  const shared = useProfileContext();
  const sharedUser = shared?.token === token ? shared.user : null;
  const [state, setState] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!token || sharedUser) return;
    let active = true;
    getProfile().then((user) => {
      const forbidden = (adminOnly && !hasRole(user, ROLES.ADMIN)) || (driverOnly && !hasRole(user, ROLES.DRIVER));
      if (active) setState({ token, user, error: forbidden ? "forbidden" : "" });
    }).catch((error) => {
      if (active) setState({ token, error: [401, 403].includes(error.response?.status) ? "auth" : "load" });
    });
    return () => { active = false; };
  }, [adminOnly, driverOnly, token, retry, sharedUser]);
  const current = sharedUser ? { token, user: sharedUser, error: (adminOnly && !hasRole(sharedUser, ROLES.ADMIN)) || (driverOnly && !hasRole(sharedUser, ROLES.DRIVER)) ? "forbidden" : "" } : state;
  if (isLoading) return fallback || <PageSkeleton title={adminOnly ? "Administration" : driverOnly ? "Driver workspace" : "Your account"} />;
  const error = !token ? "auth" : current?.token === token ? current.error : "";
  if (error === "load") return <ErrorState title="Unable to verify your account" description="Please try again when your connection is available." action={<Button onClick={() => { setState(null); setRetry((value) => value + 1); }}>Try again</Button>} />;
  if (error) return <div className="mx-auto grid min-h-[55vh] max-w-lg place-items-center text-center"><div><h1 className="text-2xl font-bold">{error === "forbidden" ? `${driverOnly ? "Driver" : "Admin"} access required` : "Sign in required"}</h1><p className="mt-2 text-sm text-[var(--muted)]">{error === "forbidden" ? "This account does not have permission to open this page." : "Sign in to access this page."}</p><Link href={error === "forbidden" ? "/" : driverOnly ? "/login?redirect=/driver/dashboard" : "/login"} className="mt-5 inline-block rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-contrast)]">{error === "forbidden" ? "Back to home" : "Sign in"}</Link></div></div>;
  if (!current || current.token !== token) return fallback || <PageSkeleton title={adminOnly ? "Administration" : driverOnly ? "Driver workspace" : "Your account"} />;
  return children(current.user);
}
