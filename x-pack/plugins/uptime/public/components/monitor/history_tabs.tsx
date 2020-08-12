/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import React from 'react';
import { EuiTabbedContent } from '@elastic/eui';
import { PingList } from './ping_list';
import { useMonitorId } from '../../hooks';
import { IncidentList } from './incident_list/incident_list';

export const HistoryTabs = () => {
  const monitorId = useMonitorId();

  const tabs = [
    {
      id: 'incidents--id',
      name: 'Incidents',
      content: <IncidentList />,
    },
    {
      id: 'ping--id',
      name: 'Pings',
      content: <PingList monitorId={monitorId} />,
    },
  ];
  return (
    <EuiTabbedContent
      tabs={tabs}
      initialSelectedTab={tabs[0]}
      autoFocus="selected"
      onTabClick={(tab) => {
        console.log('clicked tab', tab);
      }}
    />
  );
};
