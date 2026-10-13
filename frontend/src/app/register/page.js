import { Suspense } from "react";
import RegisterPage from "../../components/auth/RegisterPage";
import { LoadingPageShell } from "../../components/common/LoadingPageShell";

export const metadata = {
  title: "Create Account | Smart Safar Faisalabad",
  description: "Create a Smart Safar Faisalabad commuter account.",
};

export default function RegisterRoute() {
  return (
    <Suspense fallback={<LoadingPageShell title="Create account" />}>
      <RegisterPage />
    </Suspense>
  );
}
