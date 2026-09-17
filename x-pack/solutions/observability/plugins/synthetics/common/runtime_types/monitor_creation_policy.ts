/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';

// Attributes of the monitor-creation-policy document on
// `synthetics-settings-multi-space` (id `synthetics-settings-multi-space-monitor-policy`).
// Spaces are SO namespaces, independent of the CCS document of the same type.
export const syntheticsMonitorCreationPolicySchema = t.partial({
  // Per-space allow-list of creatable monitor types. Empty/undefined = all allowed.
  allowedMonitorTypes: t.array(t.string),
  // Floor on monitor frequency. Empty/undefined = no extra restriction.
  // Values match the schedule dropdown: `'10s'` / `'30s'` or minute numbers `'1'`…`'240'`.
  minimumMonitorFrequency: t.string,
});

export type SyntheticsMonitorCreationPolicy = t.TypeOf<
  typeof syntheticsMonitorCreationPolicySchema
>;

export interface SyntheticsMonitorCreationPolicyWithSpaces extends SyntheticsMonitorCreationPolicy {
  spaces: string[];
}
