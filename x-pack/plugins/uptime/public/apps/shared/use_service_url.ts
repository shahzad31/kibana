/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEsSearch } from '../../../../observability/public';
import { Ping } from '../../../common/runtime_types';

export const useServiceUrl = () => {
  const { data, loading } = useEsSearch(
    {
      index: 'remote_cluster:apm-*,remote_cluster:traces-apm*,apm-*,traces-apm*',
      body: {
        size: 1,
        query: {
          bool: {
            filter: [
              {
                range: {
                  '@timestamp': {
                    gte: 'now-24h/h',
                    lte: 'now',
                  },
                },
              },
              {
                match_phrase: {
                  'service.name': 'kibana-frontend',
                },
              },
            ],
          },
        },
      },
    },
    [],
    { name: '' }
  );

  const doc = data?.hits.hits?.[0]?._source as Ping;

  return { loading, url: (doc?.url?.scheme ?? '') + '//' + (doc?.url?.domain ?? '') };
};
