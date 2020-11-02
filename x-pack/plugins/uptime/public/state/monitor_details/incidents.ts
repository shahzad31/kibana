/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { handleActions } from 'redux-actions';
import { takeLatest } from 'redux-saga/effects';
import { createAsyncAction } from '../actions/utils';
import { asyncInitState, handleAsyncAction } from '../reducers/utils';
import { CertResult, GetCertsParams } from '../../../common/runtime_types';
import { AppState } from '../index';
import { fetchEffectFactory } from '../effects/fetch_effect';
import { fetchIncidents } from '../api/incidents';
import { AsyncInitState } from '../reducers/types';

export const getIncidentsAction = createAsyncAction<GetCertsParams, CertResult>('GET_INCIDENTS');

interface IncidentsState {
  incidents: AsyncInitState<CertResult>;
}

const initialState = {
  incidents: asyncInitState(),
};

export const incidentsReducer = handleActions<any>(
  {
    ...handleAsyncAction<IncidentsState>('incidents', getIncidentsAction),
  },
  initialState
);

export function* fetchIncidentsEffect() {
  yield takeLatest(
    getIncidentsAction.get,
    fetchEffectFactory(fetchIncidents, getIncidentsAction.success, getIncidentsAction.fail)
  );
}

export const incidentsSelector = ({ incidents }: AppState) => incidents.incidents;
