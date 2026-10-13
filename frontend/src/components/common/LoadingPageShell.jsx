import { Navbar } from "../navigation/Navbar";
import { Footer } from "../navigation/Footer";
import { PageSkeleton } from "./SectionSkeleton";
export function LoadingPageShell({ title, variant, children }) {
  return <><Navbar /><main>{children || <PageSkeleton title={title} variant={variant} />}</main><Footer /></>;
}
