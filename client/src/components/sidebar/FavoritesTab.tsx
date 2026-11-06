import { useQuery } from '@tanstack/react-query';
import { ExternalLink, GitMerge, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Selection } from '../../App';
import { getRoutes, type BikeFilter, type RouteSummary } from '../../api';
import { formatDate, formatElevation, formatKm } from '../../format';
import { usePreviewHandlers } from '../../preview';
import { qk } from '../../queryKeys';
import { RouteName } from '../ui/badges';
import { cx } from '../ui/cx';
import { SearchInput, ToggleChip } from '../ui/fields';
import { Menu } from '../ui/Menu';
import { Metrics } from '../ui/Metrics';
import RoutePicker from '../ui/RoutePicker';
import { EmptyState, SkeletonRows } from '../ui/states';
import { countFavorites, favoriteGroups, type Favorite, type FavoriteKind } from './favorites';
import { EMPTY_METRIC_FILTER, matchesMetrics, type MetricFilter } from './metricFilter';
import RouteDetail from './RouteDetail';
import { BikeDots, RouteRow } from './RoutesTab';
import { mergeTargets, useMergeRoute } from './useMergeRoute';

interface Props {
  bikeFilter: BikeFilter;
  /** Distance / elevation bounds from the sidebar's filter panel (matched on route averages). */
  metricFilter?: MetricFilter;
  selection: Selection;
  onSelectRoute(routeId: string | null): void;
  onSelectRide(rideId: string | null, routeId?: string | null): void;
}

const KINDS: Array<{ value: FavoriteKind; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'gravel', label: 'Gravel' },
  { value: 'road', label: 'Road' },
];

/**
 * Favourite routes: everything named with a star rating ("5SG …"), best first. A route ridden
 * several times opens like in the Routes tab; one ridden once is shown and selected as that ride.
 */
export default function FavoritesTab({
  bikeFilter,
  metricFilter = EMPTY_METRIC_FILTER,
  selection,
  onSelectRoute,
  onSelectRide,
}: Props) {
  const {
    data: routes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: qk.routes(bikeFilter),
    queryFn: () => getRoutes(bikeFilter),
  });
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<FavoriteKind>('all');

  const groups = useMemo(
    () =>
      favoriteGroups(
        (routes ?? []).filter((r) =>
          matchesMetrics(r.avg_distance_km, r.avg_elevation_gain_m, metricFilter)
        ),
        kind,
        search
      ),
    [routes, kind, search, metricFilter]
  );
  const hasAny = useMemo(() => countFavorites(routes) > 0, [routes]);
  const maxCount = useMemo(() => Math.max(1, ...(routes ?? []).map((r) => r.ride_count)), [routes]);
  // A route ridden once has no route page row here, so its merge is offered from the row menu.
  const [mergeSource, setMergeSource] = useState<RouteSummary | null>(null);
  const merge = useMergeRoute(() => onSelectRide(null));
  const mergeOptions = useMemo(
    () => (mergeSource ? mergeTargets(routes ?? [], mergeSource.id) : []),
    [routes, mergeSource]
  );

  const detailId = selection.routeId;
  return (
    <>
      <div hidden={!!detailId} className="flex min-h-0 flex-1 flex-col">
        <div className="space-y-2 border-b border-line p-3">
          <SearchInput
            placeholder="Search favorites…"
            aria-label="Search favorites"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div role="group" aria-label="Filter favorites by surface" className="-mx-1 flex gap-1">
            {KINDS.map((k) => (
              <ToggleChip key={k.value} pressed={kind === k.value} onClick={() => setKind(k.value)}>
                {k.label}
              </ToggleChip>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {isLoading && <SkeletonRows />}
          {isError && (
            <EmptyState tone="danger">Could not load routes. Is the server running?</EmptyState>
          )}
          {routes && !hasAny && (
            <EmptyState icon={<Star />}>
              No favorites yet. Rate a route by starting its name with 1S to 6S, optionally followed
              by G (gravel) or R (road), for example “5SG Forest loop”.
            </EmptyState>
          )}
          {routes && hasAny && groups.length === 0 && (
            <EmptyState icon={<Star />}>No favorites match the search or filter.</EmptyState>
          )}
          {groups.map((group) => (
            <section key={group.stars} aria-label={`${group.stars} stars`} className="mb-2">
              <h3 className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-xs font-medium text-muted">
                <span className="flex text-heat-3" aria-hidden>
                  {Array.from({ length: group.stars }, (_, i) => (
                    <Star key={i} className="size-3 fill-current" />
                  ))}
                </span>
                {group.stars} stars
                <span className="tnum text-faint">{group.favorites.length}</span>
              </h3>
              {group.favorites.map((f) =>
                f.route.ride_count > 1 || !f.route.reference_ride_id ? (
                  <RouteRow
                    key={f.route.id}
                    route={f.route}
                    maxCount={maxCount}
                    onSelect={() => onSelectRoute(f.route.id)}
                  />
                ) : (
                  <SingleRideRow
                    key={f.route.id}
                    favorite={f}
                    selected={selection.rideId === f.route.reference_ride_id}
                    onSelect={() =>
                      onSelectRide(
                        selection.rideId === f.route.reference_ride_id
                          ? null
                          : f.route.reference_ride_id
                      )
                    }
                    onOpenRoute={() => onSelectRoute(f.route.id)}
                    onMerge={() => setMergeSource(f.route)}
                  />
                )
              )}
            </section>
          ))}
        </div>
      </div>
      {mergeSource && (
        <RoutePicker
          title="Merge into another route"
          routes={mergeOptions}
          onPick={(id) => {
            const target = mergeOptions.find((r) => r.id === id);
            setMergeSource(null);
            if (target) void merge.askMerge(mergeSource, target);
          }}
          onClose={() => setMergeSource(null)}
        />
      )}
      {detailId && (
        <RouteDetail
          key={detailId}
          routeId={detailId}
          summary={routes?.find((r) => r.id === detailId)}
          allRoutes={routes ?? []}
          selectedRideId={selection.rideId}
          backLabel="Favorites"
          onBack={() => onSelectRoute(null)}
          onSelectRoute={onSelectRoute}
          onSelectRide={(rideId) =>
            onSelectRide(selection.rideId === rideId ? null : rideId, detailId)
          }
        />
      )}
    </>
  );
}

/**
 * A favourite ridden only once: selecting it selects that ride, no route page needed. The menu
 * still reaches the route page and merging (e.g. a ride the matcher didn't group).
 */
function SingleRideRow({
  favorite,
  selected,
  onSelect,
  onOpenRoute,
  onMerge,
}: {
  favorite: Favorite;
  selected: boolean;
  onSelect(): void;
  onOpenRoute(): void;
  onMerge(): void;
}) {
  const { route } = favorite;
  const preview = usePreviewHandlers(
    route.reference_ride_id ? { kind: 'ride', id: route.reference_ride_id } : null
  );
  return (
    <div
      {...preview}
      className={cx(
        'group relative flex items-start gap-1 rounded-md pr-1.5 transition-colors',
        selected ? 'bg-active' : 'hover:bg-raised'
      )}
    >
      {selected && (
        <span aria-hidden className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-signal" />
      )}
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className="min-w-0 flex-1 py-2.5 pl-3 text-left"
      >
        <span className="flex items-center gap-2">
          <RouteName name={route.name} className="flex-1 text-sm font-medium text-fg" />
          <BikeDots bikeTypes={route.bike_types} />
        </span>
        <Metrics
          className="mt-1"
          items={[
            formatKm(route.avg_distance_km, 0),
            formatElevation(route.avg_elevation_gain_m),
            `ridden once, ${formatDate(route.last_ridden)}`,
          ]}
        />
      </button>
      <Menu
        label="Route actions"
        className="mt-2 opacity-60 group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
        items={[
          { label: 'Open route page', icon: <ExternalLink />, onSelect: onOpenRoute },
          { label: 'Merge into another route…', icon: <GitMerge />, onSelect: onMerge },
        ]}
      />
    </div>
  );
}
