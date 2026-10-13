"use client";
import { useDataSaver } from "../../hooks/useDataSaver";
import Image from "next/image";

const visuals = {
  transit: { asset: "transit-live", position: "58% center" },
  routes: { asset: "transit-road", position: "64% center" },
  stops: { asset: "transit-stop", position: "70% center" },
  fleet: { asset: "transit-fleet", position: "65% center" },
  booking: { asset: "transit-tickets", position: "72% center" },
  journey: { asset: "transit-road", position: "65% center" },
  shift: { asset: "transit-road", position: "68% center" },
  driver: { asset: "transit-fleet", position: "65% center" },
};

export function CardBackdrop({ visual = "transit", priority = false }) {
  const { enabled } = useDataSaver();
  if (enabled) return null;
  const artwork = visuals[visual];
  if (!artwork) return <div className={`card-backdrop card-backdrop--pattern card-backdrop--${visual}`} aria-hidden="true" />;
  return <div className={`card-backdrop card-backdrop--photo card-backdrop--${visual}`} aria-hidden="true">
    <Image
      src={`/images/cards/${artwork.asset}.webp`}
      alt=""
      fill
      priority={priority}
      sizes="(max-width: 640px) 100vw, (max-width: 1200px) 70vw, 720px"
      className="card-backdrop__image object-cover"
      style={{ objectPosition: artwork.position }}
    />
    <div className="card-backdrop__wash" />
  </div>;
}
