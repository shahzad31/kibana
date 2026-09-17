/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsClientContract } from '@kbn/core-saved-objects-api-server';
import type {
  SyntheticsMultiSpaceSettings,
  SyntheticsMultiSpaceSettingsWithSpaces,
} from '../../common/runtime_types';
import {
  SYNTHETICS_SETTINGS_MULTI_SPACE_CCS_ID,
  SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
  SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
} from '../saved_objects/synthetics_settings_multi_space';
import { NamespacedSingletonRepository } from './namespaced_singleton_repository';

export interface SyntheticsMultiSpaceSettingsRepository {
  get(): Promise<SyntheticsMultiSpaceSettingsWithSpaces>;
  save(
    settings: SyntheticsMultiSpaceSettings,
    spaces?: string[]
  ): Promise<SyntheticsMultiSpaceSettingsWithSpaces>;
}

export interface SyntheticsMultiSpaceSettingsAttributes {
  useAllRemoteClusters: boolean;
  selectedRemoteClusters: string[];
}

export const DEFAULT_MULTI_SPACE_SETTINGS: SyntheticsMultiSpaceSettingsAttributes = {
  useAllRemoteClusters: false,
  selectedRemoteClusters: [],
};

export class DefaultSyntheticsMultiSpaceSettingsRepository
  implements SyntheticsMultiSpaceSettingsRepository
{
  private readonly inner: NamespacedSingletonRepository<SyntheticsMultiSpaceSettingsAttributes>;

  constructor(soClient: SavedObjectsClientContract) {
    this.inner = new NamespacedSingletonRepository(soClient, {
      soType: SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
      objectId: SYNTHETICS_SETTINGS_MULTI_SPACE_CCS_ID,
      defaults: DEFAULT_MULTI_SPACE_SETTINGS,
      siblingIds: [SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID],
      allowUnnamedLegacy: true,
    });
  }

  get(): Promise<SyntheticsMultiSpaceSettingsWithSpaces> {
    return this.inner.get();
  }

  save(
    settings: SyntheticsMultiSpaceSettings,
    spaces?: string[]
  ): Promise<SyntheticsMultiSpaceSettingsWithSpaces> {
    return this.inner.save(settings, spaces);
  }
}
