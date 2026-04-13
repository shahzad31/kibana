/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { z } from '@kbn/zod';

const compositeSloIdSchema = z
  .string()
  .min(8)
  .max(48)
  .regex(
    /^[a-z0-9-_]+$/,
    'Invalid slo id, must be between 8 and 48 characters and contain only letters, numbers, hyphens, and underscores'
  );

const compositeTagsSchema = z.array(z.string());

const compositeTargetSchema = z.object({ target: z.number() });

const compositeOccurrencesBudgetingMethodSchema = z.literal('occurrences');

const compositeRollingTimeWindowSchema = z.object({
  duration: z.string(),
  type: z.literal('rolling'),
});

const compositeSloMemberSchema = z.object({
  sloId: compositeSloIdSchema,
  weight: z.number(),
  instanceId: z.string().optional(),
});

const compositeMethodSchema = z.literal('weightedAverage');

const compositeSloDefinitionSchema = z.object({
  id: compositeSloIdSchema,
  name: z.string(),
  description: z.string(),
  members: z.array(compositeSloMemberSchema),
  compositeMethod: compositeMethodSchema,
  timeWindow: compositeRollingTimeWindowSchema,
  budgetingMethod: compositeOccurrencesBudgetingMethodSchema,
  objective: compositeTargetSchema,
  tags: compositeTagsSchema,
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  updatedBy: z.string(),
  version: z.number(),
});

const storedCompositeSloDefinitionSchema = compositeSloDefinitionSchema;

type CompositeSLOMember = z.infer<typeof compositeSloMemberSchema>;
type CompositeMethod = z.infer<typeof compositeMethodSchema>;

export type { CompositeSLOMember, CompositeMethod };

export {
  compositeSloIdSchema,
  compositeTagsSchema,
  compositeTargetSchema,
  compositeOccurrencesBudgetingMethodSchema,
  compositeRollingTimeWindowSchema,
  compositeSloMemberSchema,
  compositeMethodSchema,
  compositeSloDefinitionSchema,
  storedCompositeSloDefinitionSchema,
};
