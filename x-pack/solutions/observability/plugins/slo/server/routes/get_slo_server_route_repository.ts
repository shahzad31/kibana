/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getSloRouteRepository } from './slo/route';
import type { createCompositeSLORoute } from './slo/composite_slo/create_composite_slo';
import type { getCompositeSLORoute } from './slo/composite_slo/get_composite_slo';
import type { findCompositeSLORoute } from './slo/composite_slo/find_composite_slo';
import type { updateCompositeSLORoute } from './slo/composite_slo/update_composite_slo';
import type { deleteCompositeSLORoute } from './slo/composite_slo/delete_composite_slo';
import type { fetchCompositeHistoricalSummaryRoute } from './slo/composite_slo/fetch_composite_historical_summary';

interface RouteRepositoryOptions {
  isServerless?: boolean;
  isCompositeSloEnabled?: boolean;
}

export function getSloServerRouteRepository({
  isServerless,
  isCompositeSloEnabled,
}: RouteRepositoryOptions = {}) {
  return getSloRouteRepository({ isServerless, isCompositeSloEnabled });
}

type CompositeRoutes = typeof createCompositeSLORoute &
  typeof getCompositeSLORoute &
  typeof findCompositeSLORoute &
  typeof updateCompositeSLORoute &
  typeof deleteCompositeSLORoute &
  typeof fetchCompositeHistoricalSummaryRoute;

export type SLORouteRepository = ReturnType<typeof getSloServerRouteRepository> & CompositeRoutes;
