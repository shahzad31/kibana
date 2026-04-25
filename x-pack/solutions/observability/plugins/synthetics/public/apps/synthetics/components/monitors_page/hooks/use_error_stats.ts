/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useFetcher } from '@kbn/observability-shared-plugin/public';
import { SYNTHETICS_API_URLS } from '../../../../../../common/constants';
import type { ErrorStats } from '../../../../../../common/runtime_types';
import { apiService } from '../../../../../utils/api_service/api_service';
import { useSyntheticsRefreshContext } from '../../../contexts';
import { useGetUrlParams } from '../../../hooks';

export function useErrorStats() {
  const { lastRefresh } = useSyntheticsRefreshContext();
  const { dateRangeStart, dateRangeEnd, query, monitorTypes, locations, tags, projects } =
    useGetUrlParams();

  const { data, loading } = useFetcher(async () => {
    const params: Record<string, string> = {
      from: dateRangeStart,
      to: dateRangeEnd,
    };
    if (monitorTypes) {
      params.monitorTypes = JSON.stringify(
        Array.isArray(monitorTypes) ? monitorTypes : [monitorTypes]
      );
    }
    if (locations) {
      params.locations = JSON.stringify(Array.isArray(locations) ? locations : [locations]);
    }
    if (tags) {
      params.tags = JSON.stringify(Array.isArray(tags) ? tags : [tags]);
    }
    if (projects) {
      params.projects = JSON.stringify(Array.isArray(projects) ? projects : [projects]);
    }
    if (query) {
      params.query = query;
    }

    return apiService.get<ErrorStats>(SYNTHETICS_API_URLS.ERROR_STATS, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefresh, dateRangeStart, dateRangeEnd, query, monitorTypes, locations, tags, projects]);

  return {
    stats: data ?? null,
    loading: Boolean(loading),
  };
}
