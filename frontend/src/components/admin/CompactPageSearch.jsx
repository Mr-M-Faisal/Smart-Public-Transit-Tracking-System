"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { SearchInput } from "../common/SearchInput";

// Each page owns its query, so this filters only data already loaded for that page.
export function CompactPageSearch({ label, placeholder, value, onChange, className = "" }) {
  const [open, setOpen] = useState(Boolean(value));
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function close() {
    onChange("");
    setOpen(false);
  }

  return <div className={`compact-page-search ${className}`}>
    {open ? <SearchInput inputRef={inputRef} value={value} onChange={onChange} onClear={close} label={label} placeholder={placeholder} /> : <button type="button" className="compact-page-search__trigger" onClick={() => setOpen(true)} aria-label={label} title={label}><Search size={17} /></button>}
  </div>;
}