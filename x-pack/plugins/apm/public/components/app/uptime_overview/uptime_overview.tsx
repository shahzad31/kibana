/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { useApmPluginContext } from '../../../context/apm_plugin/use_apm_plugin_context';
import { useApmServiceContext } from '../../../context/apm_service/use_apm_service_context';

export function UptimeOverview() {
  const {
    uptime: { MonitorOverview },
  } = useApmPluginContext();

  const { serviceName } = useApmServiceContext();

  return <MonitorOverview serviceName={serviceName} />;
}
