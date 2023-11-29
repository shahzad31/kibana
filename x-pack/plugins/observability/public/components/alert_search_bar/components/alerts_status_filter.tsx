/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiSelect } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import React from 'react';
import { ALL_ALERTS, ACTIVE_ALERTS, RECOVERED_ALERTS, UNTRACKED_ALERTS } from '../constants';
import { AlertStatusFilterProps } from '../types';
import { AlertStatus } from '../../../../common/typings';

const options = [
  {
    id: ALL_ALERTS.status,
    text: ALL_ALERTS.label,
    value: ALL_ALERTS.query,
  },
  {
    id: ACTIVE_ALERTS.status,
    text: ACTIVE_ALERTS.label,
    value: ACTIVE_ALERTS.query,
  },
  {
    id: RECOVERED_ALERTS.status,
    text: RECOVERED_ALERTS.label,
    value: RECOVERED_ALERTS.query,
  },
  {
    id: UNTRACKED_ALERTS.status,
    text: UNTRACKED_ALERTS.label,
    value: UNTRACKED_ALERTS.query,
  },
];

export function AlertsStatusFilter({ status, onChange }: AlertStatusFilterProps) {
  return (
    <EuiSelect
      data-test-subj="o11yAlertsStatusFilterSelect"
      aria-label={i18n.translate('xpack.observability.alerts.alertStatusFilter.legend', {
        defaultMessage: 'Filter by',
      })}
      options={options}
      value={status}
      onChange={(evt) => onChange(evt.target.value as AlertStatus)}
    />
  );
}
