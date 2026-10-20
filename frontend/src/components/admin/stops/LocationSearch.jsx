"use client";

import { useEffect, useRef, useState } from "react";
import { SearchInput } from "../../common/SearchInput";
import { MapPin, Search } from "lucide-react";
import { Button } from "../../common/Button";
import { locationSearchService } from "../../../services/locationSearchService";

export function LocationSearch({ idPrefix, disabled, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const activeSearch = useRef(null);

  useEffect(() => () => activeSearch.current?.abort(), []);

  async function search() {
    const submittedQuery = query.trim();
    if (!submittedQuery) {
      setResults([]);
      setStatus("error");
      setMessage("Enter a location to search.");
      return;
    }

    activeSearch.current?.abort();
    const controller = new AbortController();
    activeSearch.current = controller;
    setStatus("searching");
    setMessage("Searching...");
    setSelectedId("");

    try {
      const nextResults = await locationSearchService.search(submittedQuery, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setResults(nextResults);
      setStatus(nextResults.length ? "results" : "empty");
      setMessage(nextResults.length ? `Select a location. ${nextResults.length} ${nextResults.length === 1 ? "result" : "results"} found.` : "No matching location was found. Try a shorter name, nearby landmark, road name, or chowk name. You can still select the location directly on the map.");
    } catch (error) {
      if (error.name === "AbortError") return;
      setResults([]);
      setStatus("error");
      setMessage("Location search is temporarily unavailable.");
    } finally {
      if (activeSearch.current === controller) activeSearch.current = null;
    }
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!disabled && status !== "searching") search();
  }

  function selectResult(result) {
    setSelectedId(result.id);
    setMessage(`${result.name} selected. Adjust the marker on the map for the exact stop position.`);
    onSelect([result.latitude, result.longitude]);
  }

  const searching = status === "searching";
  return <div className="space-y-2">
    <label htmlFor={idPrefix + "-location-search"} className="block text-xs font-semibold">Search Location</label>
    <div role="search" className="flex min-w-0 flex-col gap-2 sm:flex-row">
      <SearchInput id={idPrefix + "-location-search"} value={query} onChange={setQuery} onKeyDown={handleKeyDown} disabled={disabled || searching} loading={searching} label="Search Location" placeholder="Search a location..." autoComplete="off" aria-describedby={idPrefix + "-search-status"} />
      <Button type="button" variant="secondary" onClick={search} disabled={disabled || searching} className="min-h-11 shrink-0 gap-2">
        <Search size={16} aria-hidden="true" /> {searching ? "Searching..." : "Search"}
      </Button>
    </div>
    <p id={idPrefix + "-search-status"} role="status" className={`text-sm ${status === "error" || status === "empty" ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>{message}</p>
    {results.length > 0 && <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
      <p className="border-b border-[var(--border)] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Search Results</p>
      <ul className="max-h-52 overflow-y-auto overscroll-contain">
        {results.map((result) => <li key={result.id} className="border-b border-[var(--border)] last:border-b-0">
          <button
            type="button"
            onClick={() => selectResult(result)}
            disabled={disabled}
            className={`flex w-full min-w-0 gap-3 px-3 py-3 text-left transition hover:bg-[var(--primary-soft)] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--primary-soft-strong)] disabled:cursor-not-allowed disabled:opacity-50 ${selectedId === result.id ? "bg-[var(--primary-soft)]" : ""}`}
          >
            <MapPin size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--primary-ink)]" />
            <span className="min-w-0">
              <span className="block break-words text-sm font-semibold text-[var(--foreground)]">{result.name}</span>
              {result.address && <span className="mt-0.5 block break-words text-xs leading-5 text-[var(--muted)]">{result.address}</span>}
            </span>
          </button>
        </li>)}
      </ul>
    </div>}
    <p className="text-xs text-[var(--muted)]">Search data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="font-semibold text-[var(--primary-ink)] underline-offset-2 hover:underline">OpenStreetMap contributors</a></p>
  </div>;
}
