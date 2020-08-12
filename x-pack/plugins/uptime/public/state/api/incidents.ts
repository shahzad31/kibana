/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { API_URLS } from '../../../common/constants';
import { apiService } from './utils';
import { GetPingsParams, PingsResponse, PingsResponseType } from '../../../common/runtime_types';
import { APIFn } from './types';

export const fetchIncidents: APIFn<GetPingsParams, PingsResponse> = async ({
  dateRange: { from, to },
  ...optional
}) => await apiService.get(API_URLS.INCIDENTS, { from, to, ...optional }, PingsResponseType);
