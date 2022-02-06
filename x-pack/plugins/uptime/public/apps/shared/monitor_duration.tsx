/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { useKibana } from '../../../../../../src/plugins/kibana_react/public';
import { ClientPluginsStart } from '../plugin';
import { useTimeRange } from '../../hooks/use_time_range';
import { ALL_VALUES_SELECTED } from '../../../../observability/public';

export const MonitorDuration = ({ serviceName }: { serviceName: string }) => {
  const { observability } = useKibana<ClientPluginsStart>().services;

  const ExploratoryViewEmbeddable = observability.ExploratoryViewEmbeddable;

  const timeRange = useTimeRange();

  return (
    <div style={{ height: 300 }}>
      <ExploratoryViewEmbeddable
        attributes={[
          {
            time: timeRange,
            dataType: 'synthetics',
            selectedMetricField: 'monitor.duration.us',
            reportDefinitions: { 'monitor.name': [ALL_VALUES_SELECTED] },
            name: 'monitor-duration-series',
            seriesType: 'area',
            breakdown: 'monitor.name',
            filters: [
              {
                field: 'service.name',
                values: [serviceName],
              },
            ],
          },
        ]}
        reportType="kpi-over-time"
        title="Monitor duration"
      />
    </div>
  );
};
