/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { schema } from '@kbn/config-schema';
import { MANAGE_MONITOR_POLICY_API } from '../../feature';
import { MonitorTypeEnum } from '../../../common/runtime_types';
import { ALLOWED_FREQUENCY_POLICY_VALUES } from '../../../common/constants/monitor_defaults';
import { SYNTHETICS_API_URLS } from '../../../common/constants';
import { buildMonitorCreationPolicyRepository } from '../../services/allowed_monitor_types';
import type { SyntheticsRestApiRouteFactory } from '../types';
import type { SyntheticsMonitorCreationPolicy } from '../../../common/runtime_types';

const AllowedMonitorTypesSchema = schema.arrayOf(
  schema.oneOf([
    schema.literal(MonitorTypeEnum.HTTP),
    schema.literal(MonitorTypeEnum.TCP),
    schema.literal(MonitorTypeEnum.ICMP),
    schema.literal(MonitorTypeEnum.BROWSER),
    schema.literal(MonitorTypeEnum.API),
  ]),
  { maxSize: 10 }
);

const MinimumMonitorFrequencySchema = schema.string({
  maxLength: 8,
  validate: (value: string) => {
    if (value === '') {
      return;
    }
    if (!(ALLOWED_FREQUENCY_POLICY_VALUES as readonly string[]).includes(value)) {
      return `must be one of: ${ALLOWED_FREQUENCY_POLICY_VALUES.join(', ')}`;
    }
  },
});

const MAX_SHARED_SPACES = 500;

export interface MonitorTypesPolicy {
  allowedMonitorTypes: string[];
  minimumMonitorFrequency: string;
  spaces: string[];
}

const toPolicyResponse = (settings: {
  allowedMonitorTypes?: string[];
  minimumMonitorFrequency?: string;
  spaces: string[];
}): MonitorTypesPolicy => ({
  allowedMonitorTypes: settings.allowedMonitorTypes ?? [],
  minimumMonitorFrequency: settings.minimumMonitorFrequency ?? '',
  spaces: settings.spaces,
});

// Read-only view of the current policy + the spaces it applies to. Available to any
// Synthetics reader so the settings UI and frequency dropdowns can render current state.
export const getMonitorTypesPolicyRoute: SyntheticsRestApiRouteFactory<
  MonitorTypesPolicy
> = () => ({
  method: 'GET',
  path: SYNTHETICS_API_URLS.MONITOR_TYPES_POLICY,
  validate: false,
  handler: async ({ server, request }) => {
    const settings = await buildMonitorCreationPolicyRepository(server, request).get();
    return toPolicyResponse(settings);
  },
});

// Editing the per-space monitor creation policy (allowed types + minimum frequency)
// is gated behind the dedicated `manage-monitor-policy` privilege so monitor writers
// (base `all`) cannot widen the policy that constrains them. Stored as its own
// document on `synthetics-settings-multi-space`, so its space list is independent
// of Remote Clusters.
export const editMonitorTypesPolicyRoute: SyntheticsRestApiRouteFactory<
  MonitorTypesPolicy
> = () => ({
  method: 'PUT',
  path: SYNTHETICS_API_URLS.MONITOR_TYPES_POLICY,
  writeAccess: false,
  requiredPrivileges: [MANAGE_MONITOR_POLICY_API],
  validate: {
    body: schema.object({
      allowedMonitorTypes: AllowedMonitorTypesSchema,
      minimumMonitorFrequency: schema.maybe(MinimumMonitorFrequencySchema),
      // Spaces the policy should apply to. `*` means all spaces. Omitted keeps the current set.
      spaces: schema.maybe(
        schema.arrayOf(schema.string({ minLength: 1 }), { minSize: 1, maxSize: MAX_SHARED_SPACES })
      ),
    }),
  },
  handler: async ({ server, request }) => {
    const { allowedMonitorTypes, minimumMonitorFrequency, spaces } = request.body;
    const repository = buildMonitorCreationPolicyRepository(server, request);

    // Send only the fields we're changing; the repository merges over the stored policy.
    // Reading first would be wrong — a space-scoped read can miss the globally-shared
    // object and return defaults that would then overwrite the real stored values.
    const patch: SyntheticsMonitorCreationPolicy = { allowedMonitorTypes };
    if (minimumMonitorFrequency !== undefined) {
      patch.minimumMonitorFrequency = minimumMonitorFrequency;
    }
    const saved = await repository.save(patch, spaces);

    return toPolicyResponse(saved);
  },
});
