/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { SavedObject, SavedObjectsUpdateResponse } from '@kbn/core/server';
import { RouteContext } from '../../types';
import {
  ConfigKey,
  EncryptedSyntheticsMonitorAttributes,
  MonitorFields,
  SyntheticsMonitor,
  SyntheticsMonitorWithSecretsAttributes,
} from '../../../../common/runtime_types';
import {
  formatTelemetryUpdateEvent,
  sendTelemetryEvents,
} from '../../telemetry/monitor_upgrade_sender';

// Simplify return promise type and type it with runtime_types

export interface MonitorConfigUpdate {
  normalizedMonitor: SyntheticsMonitor;
  monitorWithRevision: SyntheticsMonitorWithSecretsAttributes;
  decryptedPreviousMonitor: SavedObject<SyntheticsMonitorWithSecretsAttributes>;
}

async function syncUpdatedMonitors({
  spaceId,
  routeContext,
  monitorsToUpdate,
}: {
  spaceId: string;
  routeContext: RouteContext;
  monitorsToUpdate: MonitorConfigUpdate[];
}) {
  const { syntheticsMonitorClient } = routeContext;

  return await syntheticsMonitorClient.editMonitors(
    monitorsToUpdate.map(({ normalizedMonitor, decryptedPreviousMonitor }) => ({
      monitor: {
        ...(normalizedMonitor as MonitorFields),
        [ConfigKey.CONFIG_ID]: decryptedPreviousMonitor.id,
        [ConfigKey.MONITOR_QUERY_ID]:
          normalizedMonitor[ConfigKey.CUSTOM_HEARTBEAT_ID] || decryptedPreviousMonitor.id,
      },
      id: decryptedPreviousMonitor.id,
      decryptedPreviousMonitor,
    })),
    spaceId
  );
}

export const syncEditedMonitorBulk = async ({
  routeContext,
  spaceId,
  monitorsToUpdate,
}: {
  monitorsToUpdate: MonitorConfigUpdate[];
  routeContext: RouteContext;
  spaceId: string;
}) => {
  const { server, monitorConfigRepository } = routeContext;

  try {
    const data = monitorsToUpdate.map(({ monitorWithRevision, decryptedPreviousMonitor }) => ({
      id: decryptedPreviousMonitor.id,
      attributes: {
        ...monitorWithRevision,
        [ConfigKey.CONFIG_ID]: decryptedPreviousMonitor.id,
        [ConfigKey.MONITOR_QUERY_ID]:
          monitorWithRevision[ConfigKey.CUSTOM_HEARTBEAT_ID] || decryptedPreviousMonitor.id,
      } as unknown as MonitorFields,
      previousMonitor: decryptedPreviousMonitor,
    }));
    const [editedMonitorSavedObjects, publicSyncErrors] = await Promise.all([
      monitorConfigRepository.bulkUpdate({
        monitors: data,
        namespace: spaceId !== routeContext.spaceId ? spaceId : undefined,
      }),
      syncUpdatedMonitors({ monitorsToUpdate, routeContext, spaceId }),
    ]);

    monitorsToUpdate.forEach(({ normalizedMonitor, decryptedPreviousMonitor }) => {
      const editedMonitorSavedObject = editedMonitorSavedObjects?.saved_objects.find(
        (obj) => obj.id === decryptedPreviousMonitor.id
      );

      sendTelemetryEvents(
        server.logger,
        server.telemetry,
        formatTelemetryUpdateEvent(
          editedMonitorSavedObject as SavedObjectsUpdateResponse<EncryptedSyntheticsMonitorAttributes>,
          decryptedPreviousMonitor.updated_at,
          server.stackVersion,
          Boolean((normalizedMonitor as MonitorFields)[ConfigKey.SOURCE_INLINE]),
          publicSyncErrors
        )
      );
    });

    return {
      errors: publicSyncErrors,
      editedMonitors: editedMonitorSavedObjects?.saved_objects,
    };
  } catch (e) {
    await rollbackCompletely({ routeContext, monitorsToUpdate });
    throw e;
  }
};

export const rollbackCompletely = async ({
  routeContext,
  monitorsToUpdate,
}: {
  monitorsToUpdate: MonitorConfigUpdate[];
  routeContext: RouteContext;
}) => {
  const { server, monitorConfigRepository } = routeContext;
  try {
    await monitorConfigRepository.bulkUpdate({
      monitors: monitorsToUpdate.map(({ decryptedPreviousMonitor }) => ({
        id: decryptedPreviousMonitor.id,
        attributes: decryptedPreviousMonitor.attributes as unknown as MonitorFields,
        previousMonitor: decryptedPreviousMonitor,
      })),
    });
  } catch (error) {
    server.logger.error(`Unable to rollback Synthetics monitors edit, Error: ${error.message}`, {
      error,
    });
  }
};
