/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { DYNAMIC_SETTINGS_DEFAULTS } from '../../common/constants';
import { DynamicSettings } from '../../common/runtime_types';
import { SavedObjectsErrorHelpers, SavedObjectsType } from '../../../../../src/core/server';
import { UMSavedObjectsQueryFn } from './adapters';

export interface UMSavedObjectsAdapter {
  dynamicSettings: DynamicSettings;
  getUptimeDynamicSettings: UMSavedObjectsQueryFn<DynamicSettings>;
  setUptimeDynamicSettings: UMSavedObjectsQueryFn<void, DynamicSettings>;
  resetState: UMSavedObjectsQueryFn<void, DynamicSettings>;
}

export const settingsObjectType = 'uptime-dynamic-settings';
export const settingsObjectId = 'uptime-dynamic-settings-singleton';

export const umDynamicSettings: SavedObjectsType = {
  name: settingsObjectType,
  hidden: false,
  namespaceType: 'single',
  mappings: {
    dynamic: false,
    properties: {
      /* Leaving these commented to make it clear that these fields exist, even though we don't want them indexed.
         When adding new fields please add them here. If they need to be searchable put them in the uncommented
         part of properties.
      heartbeatIndices: {
        type: 'keyword',
      },
      certAgeThreshold: {
        type: 'long',
      },
      certExpirationThreshold: {
        type: 'long',
      },
      defaultConnectors: {
        type: 'keyword',
      },
      */
    },
  },
};

export const savedObjectsAdapter: UMSavedObjectsAdapter = {
  dynamicSettings: DYNAMIC_SETTINGS_DEFAULTS,
  getUptimeDynamicSettings: async (client): Promise<DynamicSettings> => {
    try {
      if (savedObjectsAdapter?.dynamicSettings) {
        return savedObjectsAdapter.dynamicSettings;
      }
      const obj = await client.get<DynamicSettings>(umDynamicSettings.name, settingsObjectId);
      savedObjectsAdapter.dynamicSettings = obj?.attributes ?? DYNAMIC_SETTINGS_DEFAULTS;
      return savedObjectsAdapter.dynamicSettings;
    } catch (getErr) {
      if (SavedObjectsErrorHelpers.isNotFoundError(getErr)) {
        return DYNAMIC_SETTINGS_DEFAULTS;
      }
      throw getErr;
    }
  },
  setUptimeDynamicSettings: async (client, settings): Promise<void> => {
    await client.create(umDynamicSettings.name, settings, {
      id: settingsObjectId,
      overwrite: true,
    });
    await savedObjectsAdapter.resetState(client, settings);
  },
  resetState: async (client) => {
    const obj = await client.get<DynamicSettings>(umDynamicSettings.name, settingsObjectId);
    savedObjectsAdapter.dynamicSettings = obj?.attributes ?? DYNAMIC_SETTINGS_DEFAULTS;
  },
};
