/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsClientContract } from '@kbn/core-saved-objects-api-server';
import type {
  SyntheticsMonitorCreationPolicy,
  SyntheticsMonitorCreationPolicyWithSpaces,
} from '../../common/runtime_types';
import {
  SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
  SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
} from '../saved_objects/synthetics_settings_multi_space';
import { NamespacedSingletonRepository } from './namespaced_singleton_repository';

export interface SyntheticsMonitorCreationPolicyAttributes {
  allowedMonitorTypes: string[];
  minimumMonitorFrequency: string;
}

export const DEFAULT_MONITOR_CREATION_POLICY: SyntheticsMonitorCreationPolicyAttributes = {
  allowedMonitorTypes: [],
  minimumMonitorFrequency: '',
};

export class DefaultSyntheticsMonitorCreationPolicyRepository {
  private readonly inner: NamespacedSingletonRepository<SyntheticsMonitorCreationPolicyAttributes>;

  constructor(soClient: SavedObjectsClientContract) {
    this.inner = new NamespacedSingletonRepository(soClient, {
      soType: SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
      objectId: SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
      defaults: DEFAULT_MONITOR_CREATION_POLICY,
    });
  }

  get(): Promise<SyntheticsMonitorCreationPolicyWithSpaces> {
    return this.inner.get();
  }

  save(
    settings: SyntheticsMonitorCreationPolicy,
    spaces?: string[]
  ): Promise<SyntheticsMonitorCreationPolicyWithSpaces> {
    return this.inner.save(settings, spaces);
  }
}
