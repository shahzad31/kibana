/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createCompositeSLOParamsSchema } from '@kbn/slo-schema';
import { v4 as uuidv4 } from 'uuid';
import { DefaultCompositeSLORepository } from '../../services/composite_slo_repository';
import { createSloServerRoute } from '../create_slo_server_route';
import { assertPlatinumLicense } from './utils/assert_platinum_license';

export const createCompositeSLORoute = createSloServerRoute({
  endpoint: 'POST /api/observability/slos/composite 2023-10-31',
  options: { access: 'public' },
  security: {
    authz: {
      requiredPrivileges: ['slo_write'],
    },
  },
  params: createCompositeSLOParamsSchema,
  handler: async ({ context, params, logger, request, plugins, getScopedClients }) => {
    await assertPlatinumLicense(plugins);

    const { soClient } = await getScopedClients({ request, logger });
    const repository = new DefaultCompositeSLORepository(soClient, logger);

    const core = await context.core;
    const userId = core.security.authc.getCurrentUser()?.username;
    const now = new Date();

    const compositeSlo = {
      ...params.body,
      id: params.body.id ?? uuidv4(),
      tags: params.body.tags ?? [],
      enabled: params.body.enabled ?? true,
      revision: 1,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: userId ?? undefined,
      updatedBy: userId ?? undefined,
    };

    await repository.create(compositeSlo);

    return { id: compositeSlo.id };
  },
});
