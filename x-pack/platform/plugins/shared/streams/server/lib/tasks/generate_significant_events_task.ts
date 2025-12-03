/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TaskManagerSetupContract } from '@kbn/task-manager-plugin/server/plugin';
import type {
  ConcreteTaskInstance,
  IntervalSchedule,
  RruleSchedule,
} from '@kbn/task-manager-plugin/server';
import moment from 'moment';
import { MAINTENANCE_WINDOW_SAVED_OBJECT_TYPE } from '@kbn/maintenance-windows-plugin/common';
import pRetry from 'p-retry';
import type { SyntheticsMonitorClient } from '../synthetics_service/synthetics_monitor/synthetics_monitor_client';
import type { SyntheticsServerSetup } from '../types';

const TASK_TYPE = 'Stream:GenerateSignificantEventsTask';
export const PRIVATE_LOCATIONS_SYNC_TASK_ID = `${TASK_TYPE}-single-instance`;
const TASK_SCHEDULE = '60m';

type TaskState = Record<string, unknown>;

export type CustomTaskInstance = Omit<ConcreteTaskInstance, 'state'> & {
  state: Partial<TaskState>;
};

export class SyncPrivateLocationMonitorsTask {
  constructor(
    public serverSetup: SyntheticsServerSetup,
    public taskManager: TaskManagerSetupContract,
    public syntheticsMonitorClient: SyntheticsMonitorClient
  ) {
    taskManager.registerTaskDefinitions({
      [TASK_TYPE]: {
        title: 'Synthetics Sync Global Params Task',
        description:
          'This task is executed so that we can sync private location monitors for example when global params are updated',
        timeout: '5m',
        maxAttempts: 1,
        createTaskRunner: ({ taskInstance }) => {
          return {
            run: async () => {
              return this.runTask({ taskInstance });
            },
          };
        },
      },
    });
  }

  public async runTask({
    taskInstance,
  }: {
    taskInstance: CustomTaskInstance;
  }): Promise<{ state: TaskState; error?: Error; schedule?: IntervalSchedule | RruleSchedule }> {
    this.debugLog(
      `Syncing private location monitors, current task state is ${JSON.stringify(
        taskInstance.state
      )}`
    );

    const {
      coreStart: { savedObjects },
      encryptedSavedObjects,
      logger,
    } = this.serverSetup;
    const lastStartedAt =
      taskInstance.state.lastStartedAt || moment().subtract(10, 'minute').toISOString();
    const startedAt = taskInstance.startedAt || new Date();

    const taskState = {
      lastStartedAt: startedAt.toISOString(),
      lastTotalParams: taskInstance.state.lastTotalParams || 0,
      lastTotalMWs: taskInstance.state.lastTotalMWs || 0,
      hasAlreadyDoneCleanup: taskInstance.state.hasAlreadyDoneCleanup || false,
      maxCleanUpRetries: taskInstance.state.maxCleanUpRetries || 3,
    };

    try {
      const soClient = savedObjects.createInternalRepository([
        MAINTENANCE_WINDOW_SAVED_OBJECT_TYPE,
      ]);
    } catch (error) {
      logger.error(`Sync of private location monitors failed: ${error.message}`);
      return {
        error,
        state: taskState,
        schedule: {
          interval: TASK_SCHEDULE,
        },
      };
    }
    return {
      state: taskState,
      schedule: {
        interval: TASK_SCHEDULE,
      },
    };
  }

  start = async () => {
    const {
      pluginsStart: { taskManager },
    } = this.serverSetup;
    this.debugLog(`Scheduling private location task`);
    await taskManager.ensureScheduled({
      id: PRIVATE_LOCATIONS_SYNC_TASK_ID,
      state: {},
      schedule: {
        interval: TASK_SCHEDULE,
      },
      taskType: TASK_TYPE,
      params: {},
    });
    this.debugLog(`Sync private location monitors task scheduled successfully`);
  };

  debugLog = (message: string) => {
    this.serverSetup.logger.debug(`[SyncPrivateLocationMonitorsTask] ${message}`);
  };
}

export const runSynPrivateLocationMonitorsTaskSoon = async ({
  server,
  retries = 5,
}: {
  server: SyntheticsServerSetup;
  retries?: number;
}) => {
  try {
    await pRetry(
      async () => {
        const {
          logger,
          pluginsStart: { taskManager },
        } = server;
        logger.debug(`Scheduling Synthetics sync private location monitors task soon`);
        await taskManager.runSoon(PRIVATE_LOCATIONS_SYNC_TASK_ID);
        logger.debug(`Synthetics sync private location task scheduled successfully`);
      },
      {
        retries,
      }
    );
  } catch (error) {
    server.logger.error(
      `Error scheduling Synthetics sync private location monitors task: ${error.message}`,
      { error }
    );
  }
};
