/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import moment from 'moment';
import { UMElasticsearchQueryFn } from '../adapters/framework';
import { GetPingsParams, PingsResponse } from '../../../common/runtime_types';

const DEFAULT_PAGE_SIZE = 25;

export const getIncidents: UMElasticsearchQueryFn<GetPingsParams, PingsResponse> = async ({
  callES,
  dynamicSettings,
  dateRange: { from, to },
  index,
  monitorId,
  status,
  sort,
  size: sizeParam,
  location,
}) => {
  const size = sizeParam ?? DEFAULT_PAGE_SIZE;
  const sortParam = { sort: [{ '@timestamp': { order: sort ?? 'desc' } }] };
  const filter: any[] = [{ range: { '@timestamp': { gte: from, lte: to } } }];
  if (monitorId) {
    filter.push({ term: { 'monitor.id': monitorId } });
  }
  if (status) {
    filter.push({ term: { 'monitor.status': status } });
  }

  let postFilterClause = {};
  if (location) {
    postFilterClause = { post_filter: { term: { 'observer.geo.name': location } } };
  }
  const queryContext = { bool: { filter } };
  const params: any = {
    index: dynamicSettings.heartbeatIndices,
    body: {
      query: {
        ...queryContext,
      },
      ...sortParam,
      size: 0,
      aggs: {
        incidents: {
          composite: {
            sources: [
              {
                timestamp: {
                  terms: {
                    field: 'monitor.status_block',
                  },
                },
              },
              {
                pingLocation: {
                  terms: {
                    field: 'observer.geo.name',
                  },
                },
              },
            ],
          },
          aggs: {
            pingInfo: {
              top_hits: {
                size: 1,
              },
            },
          },
        },
      },
      ...postFilterClause,
    },
  };

  if (index) {
    params.body.from = index * size;
  }

  const { aggregations: aggs } = await callES('search', params);

  const lastStatusBlockByLocation: Record<string, string> = {};

  return aggs?.incidents.buckets.map(({ key: { pingLocation, timestamp }, pingInfo }) => {
    let duration = 0;
    if (lastStatusBlockByLocation[pingLocation]) {
      duration = moment(timestamp).diff(lastStatusBlockByLocation[pingLocation], 'm');
    }
    lastStatusBlockByLocation[pingLocation] = timestamp;
    return {
      timestamp,
      location,
      duration,
      ping: pingInfo.hits.hits[0]._source,
    };
  });
};
