/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { handleActions } from 'redux-actions';
import { takeLatest } from 'redux-saga/effects';
import { createAsyncAction } from '../actions/utils';
import { getAsyncInitialState, handleAsyncAction } from '../reducers/utils';
import { CertResult, GetCertsParams } from '../../../common/runtime_types';
import { AppState } from '../index';
import { AsyncInitialState } from '../reducers/types';
import { fetchEffectFactory } from '../effects/fetch_effect';
import { fetchIncidents } from '../api/incidents';

export const getIncidentsAction = createAsyncAction<GetCertsParams, CertResult>('GET_INCIDENTS');

interface IncidentsState {
  incidents: AsyncInitialState<CertResult>;
}

const initialState = {
  incidents: getAsyncInitialState(),
};

export const incidentsReducer = handleActions<CertificatesState>(
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
