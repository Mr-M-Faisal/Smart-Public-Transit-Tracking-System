import { Suspense } from "react";
import LoginPage from "../../components/auth/LoginPage";
import { LoadingPageShell } from "../../components/common/LoadingPageShell";

export const metadata = {
  title: "Sign In | Smart Safar Faisalabad",
  description: "Sign in to your Smart Safar Faisalabad account.",
};

export default function LoginRoute() {
  return (
    <Suspense fallback={<LoadingPageShell title="Sign in" />}>
      <LoginPage />
    </Suspense>
  );
}
