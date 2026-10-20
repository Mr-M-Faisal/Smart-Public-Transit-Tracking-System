"use client";

import { BusFront, ChevronUp } from "lucide-react";
import { SearchInput } from "../common/SearchInput";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { busLocationLabel, SEARCH_STATUSES } from "../../lib/live-map/liveBusSearch";

export function LiveBusSearch({ state, dispatch, routes, results, excluded, now, loading, error, onRetry, onSelect }) {
  const filter = (field, value) => dispatch({ type: "filter", field, value });
  return <Card treatment="operational" className="mobile-map-filters live-bus-search mt-6 p-3 sm:p-4">
    <div id="live-bus-search-body" className="live-search-body">
      <div className="live-search-input-row">
        <SearchInput value={state.searchTerm} onChange={value => filter("searchTerm", value)} placeholder="Search bus, route or stop..." label="Search bus, route or stop" aria-controls="live-bus-results" />
        <button type="button" className="live-search-collapse" aria-label={state.searchOpen ? "Collapse bus search" : "Expand bus search"} aria-expanded={state.searchOpen} aria-controls="live-bus-search-body" onClick={() => dispatch({type:"toggle-panel"})}><ChevronUp size={18} className={state.searchOpen ? "" : "rotate-180"} /></button>
      </div>
      {state.searchOpen && <><div className="live-search-filter-row">
        <select value={state.selectedRoute} onChange={event => filter("selectedRoute", event.target.value)} className="field-input" aria-label="Route filter">
          <option>All routes</option>{routes.map(route => <option key={route.id} value={route.id}>{route.label}</option>)}
        </select>
        <select value={state.selectedStatus} onChange={event => filter("selectedStatus", event.target.value)} className="field-input" aria-label="Bus status filter">
          {SEARCH_STATUSES.map(status => <option key={status}>{status}</option>)}
        </select>
      </div>
      <div className="live-search-summary"><span role="status">{results.length} matching {results.length === 1 ? "bus" : "buses"}</span><button type="button" onClick={() => dispatch({type:"reset"})}>Reset</button></div>
      {excluded > 0 && <p className="live-search-message">{excluded} matching {excluded === 1 ? "bus is" : "buses are"} hidden by the route/status filters.</p>}
      <div id="live-bus-results" className="live-search-results" aria-label="Matching buses">
        {loading ? <p className="live-search-message" role="status">Loading buses...</p> : error ? <div className="live-search-message" role="alert">Transit data unavailable. <Button type="button" variant="secondary" onClick={onRetry}>Retry</Button></div> : !results.length ? <p className="live-search-message">No matching buses found.</p> :
          <ul>{results.map(bus => <li key={bus.id}><button type="button" className="live-search-result" aria-pressed={String(bus.id) === String(state.selectedBusId)} onClick={() => onSelect(bus)}>
            <BusFront size={19} aria-hidden="true" /><span><strong>{bus.number || bus.busNumber}</strong><span>{bus.routeName}</span><small>{busLocationLabel(bus, now)}</small></span>
          </button></li>)}</ul>}
      </div>
      </>}
    </div>
  </Card>;
}
