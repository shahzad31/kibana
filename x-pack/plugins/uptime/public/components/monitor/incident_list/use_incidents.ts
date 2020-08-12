/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { useSelector, useDispatch } from 'react-redux';
import { useContext, useEffect } from 'react';
import { getPings } from '../../../state/actions';
import { UptimeRefreshContext, UptimeSettingsContext } from '../../../contexts';
import { getIncidentsAction, incidentsSelector } from '../../../state/monitor_details/incidents';
import { useMonitorId } from '../../../hooks';

export const useIncidents = () => {
  const { loading, data } = useSelector(incidentsSelector);

  const { lastRefresh } = useContext(UptimeRefreshContext);

  const { dateRangeStart: drs, dateRangeEnd: dre } = useContext(UptimeSettingsContext);

  const dispatch = useDispatch();
  const monitorId = useMonitorId();

  useEffect(() => {
    dispatch(
      getIncidentsAction.get({
        dateRange: {
          from: drs,
          to: dre,
        },
        location: '',
        monitorId,
        index: 0,
        size: 10,
        status: status !== 'all' ? status : '',
      })
    );
  }, [drs, dre, getPings, monitorId, lastRefresh, status]);

  return { loading, data };
};
