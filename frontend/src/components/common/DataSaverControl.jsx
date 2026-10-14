"use client";

import { useEffect } from "react";
import { Check, Gauge, Leaf } from "lucide-react";
import { useDataSaver } from "../../hooks/useDataSaver";

const options = [
  { id: "automatic", title: "Automatic", description: "Follow your browser's data-saving and network preference when it is available." },
  { id: "on", title: "On", description: "Reduce decorative images, prefetching, animations, and background loading." },
  { id: "off", title: "Off", description: "Use the normal Smart Safar experience." },
];

export function DataSaverOptions() {
  const { mode, enabled, ready, setMode } = useDataSaver();

  useEffect(() => {
    if (ready) document.documentElement.dataset.dataSaver = enabled ? "on" : "off";
  }, [enabled, ready]);

  return <div className="settings-data-saver" role="radiogroup" aria-label="Data Saver preference">
    {options.map((option) => {
      const selected = mode === option.id;
      return <button key={option.id} type="button" role="radio" aria-checked={selected} className={selected ? "is-selected" : undefined} onClick={() => setMode(option.id)}>
        <span className="settings-data-saver__mark">{selected ? <Check size={15} /> : option.id === "automatic" ? <Gauge size={15} /> : <Leaf size={15} />}</span>
        <span><strong>{option.title}</strong><small>{option.description}</small></span>
      </button>;
    })}
  </div>;
}