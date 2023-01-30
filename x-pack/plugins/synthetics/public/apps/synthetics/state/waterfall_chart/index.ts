/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createReducer } from '@reduxjs/toolkit';
import { PointerOverEvent } from '@elastic/charts';
import { setWaterFallChartEvent, showSideBarItemTooltip } from './actions';

export interface WaterfallChartState {
  chertEvent: PointerOverEvent | null;
  sideBarItemTooltipVisible: number | null;
}

const initialState: WaterfallChartState = {
  chertEvent: null,
  sideBarItemTooltipVisible: null,
};

export const waterfallChartReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setWaterFallChartEvent, (state, action) => {
      state.chertEvent = action.payload;
    })
    .addCase(showSideBarItemTooltip, (state, action) => {
      state.sideBarItemTooltipVisible = action.payload;
    });
});
