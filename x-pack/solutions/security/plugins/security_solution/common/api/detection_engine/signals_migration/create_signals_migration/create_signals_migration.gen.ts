/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

/*
 * NOTICE: Do not edit this file manually.
 * This file is automatically generated by the OpenAPI Generator, @kbn/openapi-generator.
 *
 * info:
 *   title: Initiates alerts migration API endpoint
 *   version: 2023-10-31
 */

import { z } from '@kbn/zod';
import { isNonEmptyString } from '@kbn/zod-helpers';

export type AlertsReindexOptions = z.infer<typeof AlertsReindexOptions>;
export const AlertsReindexOptions = z.object({
  /**
   * The throttle for the migration task in sub-requests per second. Corresponds to requests_per_second on the Reindex API.
   */
  requests_per_second: z.number().int().min(1).optional(),
  /**
   * Number of alerts to migrate per batch. Corresponds to the source.size option on the Reindex API.
   */
  size: z.number().int().min(1).optional(),
  /**
   * The number of subtasks for the migration task. Corresponds to slices on the Reindex API.
   */
  slices: z.number().int().min(1).optional(),
});

export type AlertsIndexMigrationSuccess = z.infer<typeof AlertsIndexMigrationSuccess>;
export const AlertsIndexMigrationSuccess = z.object({
  index: z.string(),
  migration_id: z.string(),
  migration_index: z.string(),
});

export type AlertsIndexMigrationError = z.infer<typeof AlertsIndexMigrationError>;
export const AlertsIndexMigrationError = z.object({
  index: z.string(),
  error: z.object({
    message: z.string(),
    status_code: z.string(),
  }),
});

export type SkippedAlertsIndexMigration = z.infer<typeof SkippedAlertsIndexMigration>;
export const SkippedAlertsIndexMigration = z.object({
  index: z.string(),
});

export type CreateAlertsMigrationRequestBody = z.infer<typeof CreateAlertsMigrationRequestBody>;
export const CreateAlertsMigrationRequestBody = z
  .object({
    /**
     * Array of index names to migrate.
     */
    index: z.array(z.string().min(1).superRefine(isNonEmptyString)).min(1),
  })
  .merge(AlertsReindexOptions);
export type CreateAlertsMigrationRequestBodyInput = z.input<
  typeof CreateAlertsMigrationRequestBody
>;

export type CreateAlertsMigrationResponse = z.infer<typeof CreateAlertsMigrationResponse>;
export const CreateAlertsMigrationResponse = z.object({
  indices: z.array(
    z.union([AlertsIndexMigrationSuccess, AlertsIndexMigrationError, SkippedAlertsIndexMigration])
  ),
});
