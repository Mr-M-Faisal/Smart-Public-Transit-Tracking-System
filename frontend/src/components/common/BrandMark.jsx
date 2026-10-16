import Image from "next/image";

export function BrandMark({ size = 40, className = "", priority = false }) {
  return (
    <Image
      src="/images/logo.png"
      unoptimized
      style={{ width: size, height: size, objectFit: "cover" }}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      priority={priority}
      className={`shrink-0 rounded-xl ${className}`}
    />
  );
}
