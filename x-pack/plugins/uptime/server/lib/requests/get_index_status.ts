/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { UMElasticsearchQueryFn } from '../adapters';
import { StatesIndexStatus } from '../../../common/runtime_types';
import { savedObjectsAdapter } from '../saved_objects';

export const getIndexStatus: UMElasticsearchQueryFn<{}, StatesIndexStatus> = async ({
  uptimeEsClient,
}) => {
  const {
    body: {
      _shards: { total },
      count,
    },
  } = await uptimeEsClient.count({ terminateAfter: 1 });
  // purpose fully ignoring the promise returned from reset state
  // we don't want to wait for it
  // this is just a mechanism to reset cache, every time uptime calls
  // index status
  savedObjectsAdapter.resetState(uptimeEsClient.getSavedObjectsClient()!);

  return {
    indexExists: total > 0,
    docCount: count,
  };
};
