import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, Upload } from 'lucide-react';
import { useMemo, useState, type ChangeEvent } from 'react';
import type { Selection, SidebarTab } from '../App';
import { getRoutes, getStats, getSuggestions, type BikeFilter, type Stats } from '../api';
import {
  BIKE,
  BIKE_TYPES,
  bikeFilterIncludes,
  toggleBikeFilter,
  type BikeFilterValue,
} from '../domain';
import { qk } from '../queryKeys';
import { countFavorites } from './sidebar/favorites';
import FavoritesTab from './sidebar/FavoritesTab';
import {
  activeMetricCount,
  EMPTY_METRIC_FILTER,
  matchesMetrics,
  type MetricFilter,
} from './sidebar/metricFilter';
import RidesTab from './sidebar/RidesTab';
import RoutesTab from './sidebar/RoutesTab';
import SuggestionsTab from './sidebar/SuggestionsTab';
import SyncStatusPanel, { useSyncWatcher } from './sidebar/SyncStatusPanel';
import { overallSyncState, STATE_DOT } from './sidebar/syncState';
import { BikeDot } from './ui/badges';
import { Button } from './ui/Button';
import { cx } from './ui/cx';
import { inputClass, ToggleChip } from './ui/fields';
import { Popover } from './ui/Popover';

interface Props {
  tab: SidebarTab;
  onTabChange(tab: SidebarTab): void;
  selection: Selection;
  onSelectRide(rideId: string | null, routeId?: string | null): void;
  onSelectRoute(routeId: string | null): void;
  onShowRoute(routeId: string): void;
  bikeFilter: BikeFilter;
  onBikeFilterChange(filter: BikeFilter): void;
  onImportClick(): void;
}

const TAB_LABEL: Record<SidebarTab, string> = {
  routes: 'Routes',
  favorites: 'Favorites',
  rides: 'Rides',
  suggestions: 'Suggestions',
};

export default function Sidebar(props: Props) {
  const { data: stats } = useQuery({ queryKey: qk.stats(), queryFn: getStats });
  // Same query the Suggestions tab uses by default, so the badge and the list agree.
  const { data: suggestions } = useQuery({
    queryKey: qk.suggestions(false),
    queryFn: () => getSuggestions(false),
  });
  // Shared with the Routes and Favorites tabs (same query key).
  const { data: routes } = useQuery({
    queryKey: qk.routes(props.bikeFilter),
    queryFn: () => getRoutes(props.bikeFilter),
  });
  // Distance / elevation bounds for the lists (not the map); the panel starts collapsed.
  const [metricFilter, setMetricFilter] = useState<MetricFilter>(EMPTY_METRIC_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const favoriteCount = useMemo(
    () =>
      routes &&
      countFavorites(
        routes.filter((r) =>
          matchesMetrics(r.avg_distance_km, r.avg_elevation_gain_m, metricFilter)
        )
      ),
    [routes, metricFilter]
  );
  const badge: Record<SidebarTab, number | undefined> = {
    routes: stats?.routes.total,
    favorites: favoriteCount,
    rides: stats?.rides.total,
    suggestions: suggestions?.counts.strong,
  };

  return (
    <aside className="flex h-full min-h-0 w-[380px] shrink-0 flex-col border-r border-line bg-panel max-[1100px]:w-[340px]">
      <header className="space-y-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <h1 className="flex min-w-0 flex-1 items-center gap-2.5 text-lg font-bold tracking-tight">
            <img src="/favicon.svg" alt="" className="size-7" />
            Ridestack
          </h1>
          <SourcesButton />
          <Button
            size="sm"
            onClick={props.onImportClick}
            icon={<Upload aria-hidden className="size-3.5" />}
          >
            Import
          </Button>
        </div>
        {stats && <Totals stats={stats} />}
        <SyncStatusPanel only="problems" />
        <div className="flex items-start gap-1">
          <BikeFilterChips
            stats={stats}
            value={props.bikeFilter}
            onChange={props.onBikeFilterChange}
          />
          <FiltersToggle
            open={filtersOpen}
            active={activeMetricCount(metricFilter)}
            onToggle={() => setFiltersOpen((o) => !o)}
          />
        </div>
        {filtersOpen && <MetricFilterPanel value={metricFilter} onChange={setMetricFilter} />}
      </header>

      <div
        className="flex overflow-x-auto border-b border-line px-1.5 [scrollbar-width:none]"
        role="tablist"
      >
        {(['routes', 'favorites', 'rides', 'suggestions'] as const).map((t) => {
          const selected = props.tab === t;
          const highlight = t === 'suggestions' && (badge[t] ?? 0) > 0;
          return (
            <button
              key={t}
              id={`tab-${t}`}
              role="tab"
              aria-selected={selected}
              aria-controls="sidebar-panel"
              onClick={() => props.onTabChange(t)}
              className={cx(
                '-mb-px flex shrink-0 grow items-center justify-center gap-1 border-b-2 px-1.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                selected ? 'border-signal text-fg' : 'border-transparent text-muted hover:text-fg'
              )}
            >
              {TAB_LABEL[t]}
              {badge[t] !== undefined && ' '}
              {badge[t] !== undefined && (
                <span
                  className={cx(
                    'tnum rounded-sm text-2xs',
                    highlight ? 'bg-signal/15 px-1 font-semibold text-signal' : 'text-faint'
                  )}
                >
                  {badge[t]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        id="sidebar-panel"
        role="tabpanel"
        aria-labelledby={`tab-${props.tab}`}
        className="flex min-h-0 flex-1 flex-col"
      >
        {props.tab === 'routes' ? (
          <RoutesTab
            bikeFilter={props.bikeFilter}
            metricFilter={metricFilter}
            selection={props.selection}
            onSelectRoute={props.onSelectRoute}
            onSelectRide={props.onSelectRide}
          />
        ) : props.tab === 'favorites' ? (
          <FavoritesTab
            bikeFilter={props.bikeFilter}
            metricFilter={metricFilter}
            selection={props.selection}
            onSelectRoute={props.onSelectRoute}
            onSelectRide={props.onSelectRide}
          />
        ) : props.tab === 'suggestions' ? (
          <SuggestionsTab
            selectedRouteId={props.selection.routeId}
            onSelectRoute={props.onSelectRoute}
          />
        ) : (
          <RidesTab
            bikeFilter={props.bikeFilter}
            metricFilter={metricFilter}
            selectedRideId={props.selection.rideId}
            onSelectRide={(id) => props.onSelectRide(id)}
            onShowRoute={props.onShowRoute}
          />
        )}
      </div>
    </aside>
  );
}

function Totals({ stats }: { stats: Stats }) {
  const figures: Array<[string, string]> = [
    [stats.rides.total.toLocaleString('en-GB'), 'rides'],
    [Math.round(stats.rides.total_distance_km).toLocaleString('en-GB'), 'km'],
    [Math.round(stats.rides.total_elevation_m).toLocaleString('en-GB'), 'm climbed'],
  ];
  return (
    <div className="flex items-baseline gap-4">
      {figures.map(([value, unit]) => (
        <span key={unit} className="text-sm">
          <span className="tnum font-semibold text-fg">{value}</span>{' '}
          <span className="text-muted">{unit}</span>
        </span>
      ))}
    </div>
  );
}

/** Sync status at a glance; the popover holds the per-provider rows and actions. */
function SourcesButton() {
  // Mounted for the app's lifetime: keeps polling and reports finished runs.
  const status = useSyncWatcher();
  const state = overallSyncState(status);
  return (
    <Popover
      label="Sync sources"
      align="end"
      className="w-80 px-4 py-2"
      trigger={(p) => (
        <button
          {...p}
          type="button"
          className="inline-flex h-7 items-center gap-2 rounded-md px-2.5 text-xs font-medium text-muted transition-colors hover:bg-raised hover:text-fg aria-expanded:bg-raised aria-expanded:text-fg"
        >
          <span aria-hidden className={cx('size-2 rounded-full', STATE_DOT[state])} />
          Sources
        </button>
      )}
    >
      <>
        <p className="pt-1 pb-1 text-xs text-faint">
          New rides arrive automatically. Sync now fetches them right away.
        </p>
        <SyncStatusPanel />
      </>
    </Popover>
  );
}

function BikeFilterChips({
  stats,
  value,
  onChange,
}: {
  stats: Stats | undefined;
  value: BikeFilter;
  onChange(filter: BikeFilter): void;
}) {
  // Unassigned is only offered while there are such rides.
  const showUnassigned = (stats?.rides.by_type.unassigned ?? 0) > 0;
  const visible: BikeFilterValue[] = showUnassigned
    ? [...BIKE_TYPES, 'unassigned']
    : [...BIKE_TYPES];
  const toggle = (v: BikeFilterValue) => onChange(toggleBikeFilter(value, v, visible));
  const count = (n: number | undefined) =>
    n === undefined ? null : (
      <>
        {' '}
        <span className="tnum text-faint">{n}</span>
      </>
    );
  return (
    <div
      role="group"
      aria-label="Filter by bike type"
      className="-ml-1 flex min-w-0 flex-1 flex-wrap gap-1"
    >
      {BIKE_TYPES.map((t) => (
        <ToggleChip key={t} pressed={bikeFilterIncludes(value, t)} onClick={() => toggle(t)}>
          <BikeDot type={t} />
          {BIKE[t].label}
          {count(stats?.rides.by_type[t])}
        </ToggleChip>
      ))}
      {showUnassigned && (
        <ToggleChip
          pressed={bikeFilterIncludes(value, 'unassigned')}
          onClick={() => toggle('unassigned')}
          title="Rides without a bike type"
        >
          <BikeDot type={null} />
          Unassigned
          {count(stats?.rides.by_type.unassigned)}
        </ToggleChip>
      )}
    </div>
  );
}

const FILTER_PANEL_ID = 'metric-filter-panel';

function FiltersToggle({
  open,
  active,
  onToggle,
}: {
  open: boolean;
  active: number;
  onToggle(): void;
}) {
  return (
    <ToggleChip
      pressed={open}
      onClick={onToggle}
      controls={FILTER_PANEL_ID}
      title="Filter by distance and elevation"
    >
      <SlidersHorizontal aria-hidden className="size-3.5" />
      Filters
      {active > 0 && (
        <>
          {' '}
          <span className="tnum rounded-sm bg-signal/15 px-1 font-semibold text-signal">
            {active}
          </span>
        </>
      )}
    </ToggleChip>
  );
}

function MetricFilterPanel({
  value,
  onChange,
}: {
  value: MetricFilter;
  onChange(filter: MetricFilter): void;
}) {
  const set = (key: keyof MetricFilter) => (e: ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: e.target.value });
  const bound = (key: keyof MetricFilter, placeholder: string, label: string) => (
    <input
      type="number"
      min="0"
      placeholder={placeholder}
      value={value[key]}
      onChange={set(key)}
      className={cx(inputClass, 'tnum h-7 w-16 px-2 text-xs')}
      aria-label={label}
    />
  );
  const rows: Array<[string, keyof MetricFilter, keyof MetricFilter, string]> = [
    ['Distance', 'minKm', 'maxKm', 'km'],
    ['Elevation', 'minElev', 'maxElev', 'm'],
  ];
  return (
    <div
      id={FILTER_PANEL_ID}
      role="group"
      aria-label="Filter by distance and elevation"
      className="flex items-end gap-3 rounded-md border border-line bg-raised/40 px-2.5 py-2"
    >
      <div className="space-y-1.5">
        {rows.map(([label, min, max, unit]) => (
          <div key={label} className="flex items-center gap-2 text-xs text-muted">
            <span className="w-16">{label}</span>
            {bound(min, 'min', `Minimum ${label.toLowerCase()}`)}
            <span aria-hidden>–</span>
            {bound(max, 'max', `Maximum ${label.toLowerCase()}`)}
            <span>{unit}</span>
          </div>
        ))}
      </div>
      {activeMetricCount(value) > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => onChange(EMPTY_METRIC_FILTER)}
        >
          Clear
        </Button>
      )}
    </div>
  );
}
