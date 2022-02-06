/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { EuiButtonEmpty } from '@elastic/eui';
import { CoreStart } from 'kibana/public';
import { PingList } from '../components/monitor';
import { store } from '../state';
import { AddMonitorFlyout } from './shared/add_monitor_flyout';
import { ClientPluginsStart } from './plugin';
import { KibanaContextProvider } from '../../../../../src/plugins/kibana_react/public';
import { MonitorDuration } from './shared/monitor_duration';
import { UptimeIndexPatternContextProvider } from '../contexts/uptime_index_pattern_context';
interface Props {
  serviceName: string;
}

export const MonitorOverview = ({ serviceName }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <EuiButtonEmpty iconType="plus" onClick={() => setIsOpen(true)}>
        Monitor service with synthetics
      </EuiButtonEmpty>
      <MonitorDuration serviceName={serviceName} />
      <PingList serviceName={serviceName} />
      {isOpen && (
        <AddMonitorFlyout onClose={() => setIsOpen(false)} initialValues={{ serviceName }} />
      )}
    </>
  );
};

export const getMonitorOverviewComponent = (
  coreStart: CoreStart,
  startPlugins: ClientPluginsStart
) => {
  return (props: Props) => {
    return (
      <ReduxProvider store={store}>
        <KibanaContextProvider
          services={{
            ...coreStart,
            ...startPlugins,
          }}
        >
          <UptimeIndexPatternContextProvider data={startPlugins.data}>
            <MonitorOverview {...props} />
          </UptimeIndexPatternContextProvider>
        </KibanaContextProvider>
      </ReduxProvider>
    );
  };
};
