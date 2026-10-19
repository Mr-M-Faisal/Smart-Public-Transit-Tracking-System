import Image from "next/image";

export function BrandMark({ size = 40, className = "", priority = false }) {
  return (
    <Image
      src="/icons/brand-128-v2.png"
      unoptimized
      style={{ width: size, height: size, objectFit: "contain" }}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      priority={priority}
      className={`shrink-0 rounded-xl ${className}`}
    />
  );
}
