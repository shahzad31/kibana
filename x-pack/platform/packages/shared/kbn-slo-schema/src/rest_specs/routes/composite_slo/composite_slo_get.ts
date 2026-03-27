/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import * as t from 'io-ts';
import {
  compositeSloComponentSchema,
  compositeSloDefinitionSchema,
  compositeSloSummarySchema,
} from '../../../schema/composite_slo';

const getCompositeSLOResponseSchema = t.intersection([
  compositeSloDefinitionSchema,
  t.type({
    summary: compositeSloSummarySchema,
    components: t.array(compositeSloComponentSchema),
  }),
]);

type GetCompositeSLOResponse = t.OutputOf<typeof getCompositeSLOResponseSchema>;

export { getCompositeSLOResponseSchema };
export type { GetCompositeSLOResponse };
