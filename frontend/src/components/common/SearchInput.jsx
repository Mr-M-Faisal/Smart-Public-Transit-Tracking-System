"use client";
import { Search, X } from "lucide-react";
export function SearchInput({ value, onChange, label, onClear, loading = false, disabled = false, inputRef, className = "", ...props }) {
 return <div role="search" className={`safar-search ${className}`} aria-busy={loading} data-disabled={disabled || undefined}>
  <Search size={18} aria-hidden="true" />
  <input {...props} ref={inputRef} type="search" value={value} onChange={event => onChange(event.target.value)} aria-label={label} disabled={disabled} />
  {value && <button type="button" aria-label={`Clear ${label.toLowerCase()}`} disabled={disabled} onClick={() => { onClear ? onClear() : onChange(""); inputRef?.current?.focus(); }}><X size={18} aria-hidden="true" /></button>}
  {loading && <span className="sr-only" role="status">Searching</span>}
 </div>;
}
