/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SavedObjectsFindResult } from '@kbn/core-saved-objects-api-server';
import { EncryptedSavedObjectsClient } from '@kbn/encrypted-saved-objects-plugin/server';
import { Logger } from '@kbn/logging';
import { ALL_SPACES_ID } from '@kbn/spaces-plugin/common/constants';
import { NewPackagePolicyWithId } from '@kbn/fleet-plugin/server/services/package_policy';
import { NewPackagePolicy } from '@kbn/fleet-plugin/common';
import { SyntheticsMonitorClient } from '../synthetics_service/synthetics_monitor/synthetics_monitor_client';
import { normalizeSecrets } from '../synthetics_service/utils';
import { SyntheticsServerSetup } from '../types';
import { syntheticsMonitorSOTypes } from '../../common/types/saved_objects';
import {
  HeartbeatConfig,
  MonitorFields,
  SyntheticsMonitorWithSecretsAttributes,
  type SyntheticsPrivateLocations,
} from '../../common/runtime_types';
import { SyntheticsPrivateLocation } from '../synthetics_service/private_location/synthetics_private_location';
import {
  formatHeartbeatRequest,
  mixParamsWithGlobalParams,
} from '../synthetics_service/formatters/public_formatters/format_configs';

export class DeployPrivateLocationMonitors extends SyntheticsPrivateLocation {
  private policiesToDelete: string[] = [];

  constructor(
    server: SyntheticsServerSetup,
    private syntheticsMonitorClient: SyntheticsMonitorClient,
    private encryptedSavedObjectsClient: EncryptedSavedObjectsClient,
    private logger: Logger,
    private allPrivateLocations: SyntheticsPrivateLocations
  ) {
    super(server);
  }

  async deployConfigs() {
    this.policiesToDelete = [];
    const newPolicyTemplate = await this.buildNewPolicy();

    const finder =
      await this.encryptedSavedObjectsClient.createPointInTimeFinderDecryptedAsInternalUser<SyntheticsMonitorWithSecretsAttributes>(
        {
          type: syntheticsMonitorSOTypes,
          perPage: 250,
          namespaces: [ALL_SPACES_ID],
        }
      );

    const paramsBySpace = await this.syntheticsMonitorClient.syntheticsService.getSyntheticsParams({
      spaceId: ALL_SPACES_ID,
    });

    for await (const result of finder.find()) {
      const configsWithPrivateLocations = result.saved_objects.filter(({ attributes }) => {
        return attributes.locations?.some((location) => !location.isServiceManaged);
      });
      await this.createUpdatePackagePolicies({
        monitors: configsWithPrivateLocations,
        paramsBySpace,
        newPolicyTemplate,
      });
    }

    await this.deletePolicyBulk(this.policiesToDelete);
  }

  async createUpdatePackagePolicies({
    monitors,
    paramsBySpace,
    newPolicyTemplate,
  }: {
    monitors: Array<SavedObjectsFindResult<SyntheticsMonitorWithSecretsAttributes>>;
    paramsBySpace: Record<string, Record<string, string>>;
    newPolicyTemplate: NewPackagePolicy;
  }) {
    const policiesToUpdate: NewPackagePolicyWithId[] = [];
    const policiesToCreate: NewPackagePolicyWithId[] = [];

    const { configsBySpaces, spaceIds } = this.mixParamsWithMonitors(monitors, paramsBySpace);
    for (const spaceId of spaceIds) {
      const configs = configsBySpaces[spaceId] || [];
      const existingPolicies = await this.getExistingPolicies({
        spaceId,
        configs,
        allPrivateLocations: this.allPrivateLocations,
      });
      const globalParams = paramsBySpace[spaceId] || {};
      for (const config of configs) {
        const { locations } = config;

        const monitorPrivateLocations = locations.filter((loc) => !loc.isServiceManaged);

        for (const privateLocation of this.allPrivateLocations) {
          const hasLocation = monitorPrivateLocations?.some((loc) => loc.id === privateLocation.id);
          const currId = this.getPolicyId(config, privateLocation.id, spaceId);
          const hasPolicy = existingPolicies?.some((policy) => policy.id === currId);
          try {
            if (hasLocation) {
              const newPolicy = await this.enrichPolicyWithData(
                config,
                privateLocation,
                newPolicyTemplate,
                spaceId,
                globalParams,
                []
              );

              if (hasPolicy) {
                policiesToUpdate.push({ ...newPolicy, id: currId } as NewPackagePolicyWithId);
              } else {
                policiesToCreate.push({ ...newPolicy, id: currId } as NewPackagePolicyWithId);
              }
            } else if (hasPolicy) {
              this.policiesToDelete.push(currId);
            }
          } catch (e) {
            this.logger.error(e);
          }
        }
      }
    }

    const [_createResponse, _deleteResponse] = await Promise.all([
      this.createPolicyBulk(policiesToCreate),
      this.updatePolicyBulk(policiesToUpdate),
    ]);
  }

  mixParamsWithMonitors(
    monitors: Array<SavedObjectsFindResult<SyntheticsMonitorWithSecretsAttributes>>,
    paramsBySpace: Record<string, Record<string, string>>
  ) {
    const configsBySpaces: Record<string, HeartbeatConfig[]> = {};
    const spaceIds = new Set<string>();

    for (const monitor of monitors) {
      const spaceId = monitor.namespaces?.[0];
      if (!spaceId) {
        continue;
      }
      spaceIds.add(spaceId);
      const normalizedMonitor = normalizeSecrets(monitor).attributes as MonitorFields;
      const { str: paramsString } = mixParamsWithGlobalParams(
        paramsBySpace[spaceId],
        normalizedMonitor
      );

      if (!configsBySpaces[spaceId]) {
        configsBySpaces[spaceId] = [];
      }

      configsBySpaces[spaceId].push(
        formatHeartbeatRequest(
          {
            spaceId,
            monitor: normalizedMonitor,
            configId: monitor.id,
          },
          paramsString
        )
      );
    }

    return { configsBySpaces, spaceIds };
  }
}
