/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';
import { dateType } from './common';
import { timeWindowSchema } from './time_window';
import { budgetingMethodSchema, objectiveSchema, sloIdSchema, tagsSchema } from './slo';

const compositeSloMemberSchema = t.intersection([
  t.type({
    sloId: sloIdSchema,
    sloRevision: t.number,
  }),
  t.partial({
    weight: t.number,
  }),
]);

const compositeMethodSchema = t.union([
  t.literal('weightedAverage'),
  t.literal('leastHealthy'),
]);

const requiredCompositeSloFields = t.type({
  id: sloIdSchema,
  name: t.string,
  description: t.string,
  members: t.array(compositeSloMemberSchema),
  compositeMethod: compositeMethodSchema,
  timeWindow: timeWindowSchema,
  budgetingMethod: budgetingMethodSchema,
  objective: objectiveSchema,
  tags: tagsSchema,
  enabled: t.boolean,
  revision: t.number,
  createdAt: dateType,
  updatedAt: dateType,
  version: t.number,
});

const optionalCompositeSloFields = t.partial({
  createdBy: t.string,
  updatedBy: t.string,
});

const compositeSloDefinitionSchema = t.intersection([
  requiredCompositeSloFields,
  optionalCompositeSloFields,
]);

const storedCompositeSloDefinitionSchema = compositeSloDefinitionSchema;

export type CompositeSLOMember = t.TypeOf<typeof compositeSloMemberSchema>;
export type CompositeMethod = t.TypeOf<typeof compositeMethodSchema>;

export {
  compositeSloMemberSchema,
  compositeMethodSchema,
  compositeSloDefinitionSchema,
  storedCompositeSloDefinitionSchema,
};