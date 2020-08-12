/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { EuiBasicTable, EuiHealth, EuiPanel, EuiSpacer, EuiText, EuiTitle } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { FormattedMessage } from '@kbn/i18n/react';
import moment from 'moment';
import React from 'react';
import { convertMicrosecondsToMilliseconds as microsToMillis } from '../../../lib/helper';
import { useIncidents } from './use_incidents';

export const IncidentList = () => {
  const { loading, data, error } = useIncidents();

  const columns: any[] = [
    {
      field: 'timestamp',
      name: i18n.translate('xpack.uptime.pingList.statusColumnLabel', {
        defaultMessage: 'Status',
      }),
      render: (timestamp: string, { ping }) => (
        <div data-test-subj={`xpack.uptime.pingList.ping-${ping.docId}`}>
          <EuiHealth color={ping?.monitor?.status === 'up' ? 'success' : 'danger'}>
            {ping?.monitor?.status === 'up'
              ? i18n.translate('xpack.uptime.pingList.statusColumnHealthUpLabel', {
                  defaultMessage: 'Up',
                })
              : i18n.translate('xpack.uptime.pingList.statusColumnHealthDownLabel', {
                  defaultMessage: 'Down',
                })}
          </EuiHealth>
          <EuiText size="xs" color="subdued">
            {i18n.translate('xpack.uptime.pingList.recencyMessage', {
              values: { fromNow: moment(timestamp).fromNow() },
              defaultMessage: 'Checked {fromNow}',
              description:
                'A string used to inform our users how long ago Heartbeat pinged the selected host.',
            })}
          </EuiText>
        </div>
      ),
    },
    {
      align: 'left',
      field: 'location',
      name: i18n.translate('xpack.uptime.incidentList.locationColumnLabel', {
        defaultMessage: 'Location',
      }),
    },
    {
      align: 'left',
      field: 'duration',
      name: i18n.translate('xpack.uptime.pingList.durationMsColumnLabel', {
        defaultMessage: 'Duration',
      }),
    },
  ];

  return (
    <EuiPanel>
      <EuiTitle size="s">
        <h4>
          <FormattedMessage id="xpack.uptime.pingList.checkHistoryTitle" defaultMessage="History" />
        </h4>
      </EuiTitle>
      <EuiSpacer size="s" />
      <EuiSpacer size="s" />
      <EuiBasicTable
        loading={loading}
        columns={columns}
        error={error?.message}
        items={data ?? []}
      />
    </EuiPanel>
  );
};
