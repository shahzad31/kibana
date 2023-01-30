/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { PointerOverEvent } from '@elastic/charts';
import { createAction } from '@reduxjs/toolkit';

export const setWaterFallChartEvent = createAction<PointerOverEvent | null>(
  'SET_WATERFALL_CHART_EVENT'
);

export const showSideBarItemTooltip = createAction<number | null>('showSideBarItemTooltip');
