"use client";
import Link from "next/link";
import { useDataSaver } from "../../hooks/useDataSaver";
export default function SmartLink({ prefetch, ...props }) {
  const { enabled } = useDataSaver();
  return <Link {...props} prefetch={enabled ? false : prefetch} />;
}
