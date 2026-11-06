import { useMutation, useQueryClient } from '@tanstack/react-query';
import { errorMessage, mergeRoutes, type RouteSummary } from '../../api';
import { invalidateRouteData } from '../../queryKeys';
import { useToast } from '../Toast';
import { useConfirm } from '../ui/Confirm';

/** Merge targets for a route: every other route, by name. */
export function mergeTargets(routes: readonly RouteSummary[], routeId: string): RouteSummary[] {
  return routes
    .filter((r) => r.id !== routeId)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

/** Merging one route into another after confirming; `onMerged` gets the surviving route's id. */
export function useMergeRoute(onMerged: (into: string) => void) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const merge = useMutation({
    mutationFn: ({ from, into }: { from: string; into: string }) => mergeRoutes(from, into),
    onSuccess: (_, { into }) => {
      toast.show('Routes merged', 'success');
      onMerged(into);
      return invalidateRouteData(queryClient);
    },
    onError: (e) => toast.show(errorMessage(e), 'error'),
  });

  const askMerge = async (source: RouteSummary, target: RouteSummary) => {
    const ok = await confirm({
      title: 'Merge routes?',
      message: `Merge all ${source.ride_count} ride(s) into "${target.name}"?`,
      confirmLabel: 'Merge',
    });
    if (ok) merge.mutate({ from: source.id, into: target.id });
  };

  return { askMerge, isPending: merge.isPending };
}
