/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  TaskManagerSetupContract,
  TaskManagerStartContract,
} from '@kbn/task-manager-plugin/server/plugin';
import type { KibanaRequest, Logger } from '@kbn/core/server';
import type {
  ConcreteTaskInstance,
  IntervalSchedule,
  RruleSchedule,
} from '@kbn/task-manager-plugin/server';
import pRetry from 'p-retry';
import type { Feature, Streams } from '@kbn/streams-schema';
import type { GetScopedClients } from '@kbn/slo-plugin/server/routes/types';
import { generateSignificantEventDefinitions } from '../significant_events/generate_significant_events';
import { getRequestAbortSignal } from '../../routes/utils/get_request_abort_signal';

const TASK_TYPE = 'Stream:GenerateSignificantEventsTask';
export const GENERATE_SIGNIFICANT_EVENTS_TASK_ID = `${TASK_TYPE}-single-instance`;
const TASK_SCHEDULE = '60m';

type TaskState = Record<string, unknown>;

export type CustomTaskInstance = Omit<ConcreteTaskInstance, 'state'> & {
  state: Partial<TaskState>;
};

interface TaskParams {
  definition: Streams.all.Definition;
  connectorId: string;
  start: number;
  end: number;
  feature?: Feature;
}

export class GenerateSignificantEventsTask {
  constructor(
    public taskManager: TaskManagerSetupContract,
    public logger: Logger,
    public getScopedClients: GetScopedClients
  ) {
    taskManager.registerTaskDefinitions({
      [TASK_TYPE]: {
        title: 'Generate Significant Events Task',
        description: 'Generates significant events for stream',
        timeout: '5m',
        maxAttempts: 1,
        createTaskRunner: ({ taskInstance, fakeRequest }) => {
          return {
            run: async () => {
              if (!fakeRequest) {
                throw new Error('Generate Significant Events Task requires a fakeRequest');
              }
              return this.runTask({ taskInstance, fakeRequest });
            },
          };
        },
      },
    });
  }

  public async runTask({
    taskInstance,
    fakeRequest,
  }: {
    taskInstance: CustomTaskInstance;
    fakeRequest: KibanaRequest;
  }): Promise<{ state: TaskState; error?: Error; schedule?: IntervalSchedule | RruleSchedule }> {
    this.debugLog(
      `Syncing private location monitors, current task state is ${JSON.stringify(
        taskInstance.state
      )}`
    );

    const { definition, connectorId, start, end, feature } = taskInstance.params as TaskParams;

    const { scopedClusterClient, inferenceClient } = await this.getScopedClients({
      request: fakeRequest,
      logger: this.logger,
    });

    try {
      generateSignificantEventDefinitions(
        {
          definition,
          feature,
          connectorId,
          start,
          end,
        },
        {
          inferenceClient,
          esClient: scopedClusterClient.asCurrentUser,
          logger: this.logger.get('significant_events'),
          signal: getRequestAbortSignal(fakeRequest),
        }
      );
    } catch (error) {
      this.logger.error(`Error running Generate Significant Events Task: ${error.message}`, {
        error,
      });
      return {
        error,
        state: {},
        schedule: {
          interval: TASK_SCHEDULE,
        },
      };
    }
    return {
      state: {},
      schedule: {
        interval: TASK_SCHEDULE,
      },
    };
  }

  debugLog = (message: string) => {
    this.logger.debug(`[GenerateSignificantEventsTask] ${message}`);
  };
}

export const runGenerateSignificantEventsTaskSoon = async ({
  taskManagerStart,
  logger,
  retries = 5,
}: {
  taskManagerStart: TaskManagerStartContract;
  retries?: number;
  logger: Logger;
}) => {
  try {
    await pRetry(
      async () => {
        logger.debug(`Scheduling Generate Significant Events Task to run soon`);
        await taskManagerStart.runSoon(GENERATE_SIGNIFICANT_EVENTS_TASK_ID);
        logger.debug(` Generate Significant Events Task scheduled to run soon`);
      },
      {
        retries,
      }
    );
  } catch (error) {
    logger.error(
      `Error scheduling Generate Significant Events Task to run soon: ${error.message}`,
      { error }
    );
  }
};
