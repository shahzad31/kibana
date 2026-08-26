/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { PluginConfigDescriptor } from '@kbn/core/server';
import type { TypeOf } from '@kbn/config-schema';
import { schema } from '@kbn/config-schema';
import { sslSchema } from '@kbn/server-http-tools';

const serviceConfig = schema.object({
  username: schema.maybe(schema.string()),
  password: schema.maybe(schema.string()),
  manifestUrl: schema.maybe(schema.string()),
  hosts: schema.maybe(schema.arrayOf(schema.string())),
  syncInterval: schema.maybe(schema.string()),
  tls: schema.maybe(sslSchema),
  devUrl: schema.maybe(schema.string()),
  showExperimentalLocations: schema.maybe(schema.boolean()),
});

const uptimeConfig = schema.object({
  index: schema.maybe(schema.string()),
  service: schema.maybe(serviceConfig),
  enabled: schema.boolean({ defaultValue: true }),
  // Operational kill-switch for the scalable private locations rebalance task.
  // Defaults off. A per-agent `condition` pin only stays correct as long as
  // the task is running to fix it up (failover off a departed agent, resolve
  // the unassigned sentinel once one enrolls, load-balance onto agents that
  // join later); with the task disabled, package-policy create/edit falls
  // back to the classic (unconditioned) payload instead of minting a pin
  // nothing will maintain — see generateNewPolicy. Existing pins already
  // stamped in Fleet are left alone until that monitor is next touched.
  rebalancePrivateLocationShardsTaskEnabled: schema.boolean({ defaultValue: false }),
});

export const config: PluginConfigDescriptor = {
  schema: uptimeConfig,
  deprecations: ({ unused }) => [unused('experimental.ccs.enabled', { level: 'warning' })],
};

export type UptimeConfig = TypeOf<typeof uptimeConfig>;
export type ServiceConfig = TypeOf<typeof serviceConfig>;
