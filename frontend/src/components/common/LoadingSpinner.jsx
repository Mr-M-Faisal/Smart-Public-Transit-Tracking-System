import { SectionSkeleton } from "./SectionSkeleton";
// Retain the existing interface for local loading states, without a spinner.
export function LoadingSpinner({ label = "Loading", className = "" }) {
  return <SectionSkeleton label={label} variant="rows" count={1} className={className} />;
}
