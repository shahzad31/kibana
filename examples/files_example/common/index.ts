/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { FileKind } from '@kbn/files-plugin/common';
import type { FileImageMetadata } from '@kbn/shared-ux-file-types';

export const PLUGIN_ID = 'filesExample';
export const PLUGIN_NAME = 'Files example';

const httpTags = {
  requiredPrivileges: [PLUGIN_ID],
};

export const exampleFileKind: FileKind = {
  id: PLUGIN_ID,
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain'],
  http: {
    create: httpTags,
    delete: httpTags,
    download: httpTags,
    getById: httpTags,
    list: httpTags,
    share: httpTags,
    update: httpTags,
  },
};

export type MyImageMetadata = FileImageMetadata;
