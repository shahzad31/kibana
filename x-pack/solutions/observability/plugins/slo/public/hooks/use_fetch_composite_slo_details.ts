/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { GetCompositeSLOResponse } from '@kbn/slo-schema';
import { useQueries } from '@kbn/react-query';
import { useMemo } from 'react';
import { sloKeys } from './query_key_factory';
import { usePluginContext } from './use_plugin_context';

export function useFetchCompositeSloDetails(ids: string[]) {
  const { sloClient } = usePluginContext();

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: sloKeys.compositeDetail(id),
      queryFn: async ({ signal }: { signal?: AbortSignal }) => {
        return await sloClient.fetch('GET /api/observability/slo_composites/{id} 2023-10-31', {
          params: { path: { id } },
          signal,
        });
      },
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const detailsById = useMemo(() => {
    const map = new Map<string, GetCompositeSLOResponse>();
    results.forEach((result, index) => {
      if (result.data) {
        map.set(ids[index], result.data as GetCompositeSLOResponse);
      }
    });
    return map;
  }, [results, ids]);

  const isLoading = results.some((r) => r.isLoading);

  return { detailsById, isLoading };
}
