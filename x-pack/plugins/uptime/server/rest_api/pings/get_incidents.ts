/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { schema } from '@kbn/config-schema';
import { UMServerLibs } from '../../lib/lib';
import { UMRestApiRouteFactory } from '../types';
import { API_URLS } from '../../../common/constants';

export const createGetIncidentsRoute: UMRestApiRouteFactory = (libs: UMServerLibs) => ({
  method: 'GET',
  path: API_URLS.INCIDENTS,
  validate: {
    query: schema.object({
      from: schema.string(),
      to: schema.string(),
      location: schema.maybe(schema.string()),
      monitorId: schema.maybe(schema.string()),
      index: schema.maybe(schema.number()),
      size: schema.maybe(schema.number()),
      sort: schema.maybe(schema.string()),
      status: schema.maybe(schema.string()),
    }),
  },
  handler: async ({ callES, dynamicSettings }, _context, request, response): Promise<any> => {
    const { from, to, ...optional } = request.query;
    const params = { dateRange: { from, to }, ...optional };

    const result = await libs.requests.getIncidents({
      callES,
      dynamicSettings,
      ...params,
    });

    return response.ok({
      body: result,
    });
  },
});
