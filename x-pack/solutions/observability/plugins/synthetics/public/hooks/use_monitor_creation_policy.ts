/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useFetcher } from '@kbn/observability-shared-plugin/public';
import { getAllowedMonitorTypesPolicy } from '../apps/synthetics/state/settings/api';

export const useMonitorCreationPolicy = () => {
  const { data, loading } = useFetcher(async () => getAllowedMonitorTypesPolicy(), []);
  return {
    minimumMonitorFrequency: data?.minimumMonitorFrequency || undefined,
    allowedMonitorTypes: data?.allowedMonitorTypes,
    loading: Boolean(loading),
  };
};
