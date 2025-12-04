/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { TaskManagerSetupContract } from '@kbn/task-manager-plugin/server';
import type { Logger } from '@kbn/logging';
import { GenerateSignificantEventsTask } from './generate_significant_events_task';

export class StreamsTasksService {
  constructor(public logger: Logger) {}
  registerTasks(taskManager: TaskManagerSetupContract) {
    new GenerateSignificantEventsTask(taskManager, this.logger);
  }
}
