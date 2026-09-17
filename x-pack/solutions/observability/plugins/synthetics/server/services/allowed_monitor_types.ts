/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { KibanaRequest } from '@kbn/core/server';
import { SECURITY_EXTENSION_ID } from '@kbn/core-saved-objects-server';
import type { SyntheticsServerSetup } from '../types';
import { DefaultSyntheticsMonitorCreationPolicyRepository } from './synthetics_monitor_creation_policy_repository';

export interface MonitorCreationPolicy {
  allowedMonitorTypes?: string[];
  minimumMonitorFrequency?: string;
}

// Policy is a separate document on `synthetics-settings-multi-space` so Remote
// Clusters space sharing cannot move or hide it. Unsecured scoped client so
// monitor writers can read it and the privilege-gated route can share it across spaces.
export const buildMonitorCreationPolicyRepository = (
  server: SyntheticsServerSetup,
  request: KibanaRequest
) => {
  const soClient = server.coreStart.savedObjects.getScopedClient(request, {
    excludedExtensions: [SECURITY_EXTENSION_ID],
  });
  return new DefaultSyntheticsMonitorCreationPolicyRepository(soClient);
};

export const getMonitorCreationPolicy = async (
  server: SyntheticsServerSetup,
  request: KibanaRequest
): Promise<MonitorCreationPolicy> => {
  const settings = await buildMonitorCreationPolicyRepository(server, request).get();
  return {
    allowedMonitorTypes: settings.allowedMonitorTypes,
    minimumMonitorFrequency: settings.minimumMonitorFrequency || undefined,
  };
};

// Per-space allow-list of creatable monitor types. `undefined`/empty means no restriction.
export const getAllowedMonitorTypes = async (
  server: SyntheticsServerSetup,
  request: KibanaRequest
): Promise<string[] | undefined> => {
  return (await getMonitorCreationPolicy(server, request)).allowedMonitorTypes;
};
