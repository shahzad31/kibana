/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import type { FindCompositeSLOResponse } from '@kbn/slo-schema';
import { useQuery } from '@kbn/react-query';
import { useKibana } from './use_kibana';
import { sloKeys } from './query_key_factory';
import { usePluginContext } from './use_plugin_context';

interface CompositeSLOListParams {
  page?: number;
  perPage?: number;
  search?: string;
}

export function useFetchCompositeSloList({
  page = 1,
  perPage = 25,
  search,
}: CompositeSLOListParams = {}) {
  const {
    notifications: { toasts },
  } = useKibana().services;
  const { sloClient } = usePluginContext();

  const { isInitialLoading, isLoading, isError, isSuccess, isRefetching, data } = useQuery({
    queryKey: sloKeys.compositeList({ page, perPage, search }),
    queryFn: async ({ signal }) => {
      return await sloClient.fetch('GET /api/observability/slo_composites 2023-10-31', {
        params: {
          query: {
            ...(search && { search }),
            page: String(page),
            perPage: String(perPage),
          },
        },
        signal,
      });
    },
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (String(error) === 'Error: Forbidden') {
        return false;
      }
      return failureCount < 4;
    },
    onError: (error: Error) => {
      toasts.addError(error, {
        title: i18n.translate('xpack.slo.compositeSloList.errorNotification', {
          defaultMessage: 'Something went wrong while fetching composite SLOs',
        }),
      });
    },
  });

  return {
    data: data as FindCompositeSLOResponse | undefined,
    isInitialLoading,
    isLoading,
    isRefetching,
    isSuccess,
    isError,
  };
}
