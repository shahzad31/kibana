/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import * as t from 'io-ts';

// CCS remote-cluster settings stored in `synthetics-settings-multi-space`
// (id `synthetics-settings-multi-space-ccs`). Monitor creation policy is a
// separate document of the same type so the two can be shared independently.
export const syntheticsMultiSpaceSettingsSchema = t.partial({
  useAllRemoteClusters: t.boolean,
  selectedRemoteClusters: t.array(t.string),
});

export type SyntheticsMultiSpaceSettings = t.TypeOf<typeof syntheticsMultiSpaceSettingsSchema>;

// API-facing shape that includes the spaces the settings are currently shared with.
// `spaces` is SO envelope metadata, not an attribute, so it lives only on this
// type and never inside the io-ts attributes codec.
export interface SyntheticsMultiSpaceSettingsWithSpaces extends SyntheticsMultiSpaceSettings {
  spaces: string[];
}
