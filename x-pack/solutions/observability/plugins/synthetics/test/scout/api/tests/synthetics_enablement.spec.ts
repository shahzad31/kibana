/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { v4 as uuidv4 } from 'uuid';
import { tags } from '@kbn/scout-oblt';
import { expect } from '@kbn/scout-oblt/api';
import { apiTest, KIBANA_HEADERS, SYNTHETICS_API_URLS } from '../fixtures';

/**
 * Ported from FTR
 * `x-pack/solutions/observability/test/api_integration_deployment_agnostic/apis/synthetics/synthetics_enablement.ts`.
 *
 * Drives *internal* enablement routes, so it uses cookie-based auth
 * (`samlAuth.asInteractiveUser` + `cookieHeader`) — matching the FTR
 * `roleScopedSupertest(..., { useCookieHeader: true })` usage.
 *
 * The api-key privilege shape differs between stateful (`read_ilm` present)
 * and serverless (no `read_ilm`). We assert a common subset with
 * `expect.arrayContaining(...)` instead of an exact match so a single spec
 * runs in both targets, sacrificing a small amount of FTR parity (exact
 * cluster-privilege list) for a simpler test surface.
 *
 * `skipMKI` parity (FTR `this.tags(['skipMKI'])`): MKI isn't a current Scout
 * observability target, so there's nothing to translate.
 */

const COMMON_SYNTHETICS_WRITER_CLUSTER_PRIVS = ['monitor', 'read_pipeline'];
const SYNTHETICS_WRITER_INDICES = [
  {
    allow_restricted_indices: false,
    names: ['synthetics-*'],
    privileges: ['view_index_metadata', 'create_doc', 'auto_configure', 'read'],
  },
];

const ENABLED_RESPONSE_ADMIN = {
  areApiKeysEnabled: true,
  canManageApiKeys: true,
  canEnable: true,
  isEnabled: true,
  isValidApiKey: true,
  isServiceAllowed: true,
};

const DISABLED_RESPONSE_EDITOR = {
  areApiKeysEnabled: true,
  canManageApiKeys: false,
  canEnable: false,
  isEnabled: false,
  isValidApiKey: false,
  isServiceAllowed: true,
};

const ENABLED_RESPONSE_EDITOR = {
  areApiKeysEnabled: true,
  canManageApiKeys: false,
  canEnable: false,
  isEnabled: true,
  isValidApiKey: true,
  isServiceAllowed: true,
};

apiTest.describe(
  'SyntheticsEnablement',
  { tag: [...tags.stateful.classic, ...tags.serverless.observability.complete] },
  () => {
    interface ApiKey {
      id: string;
      name: string;
      invalidated: boolean;
      role_descriptors: {
        synthetics_writer: {
          cluster: string[];
          indices: Array<Record<string, unknown>>;
        };
      };
    }

    const fetchApiKeys = async (
      apiClient: any,
      headers: Record<string, string>
    ): Promise<ApiKey[]> => {
      const res = await apiClient.post('internal/security/api_key/_query', {
        headers,
        body: {
          query: {
            bool: {
              filter: [
                {
                  term: { name: 'synthetics-api-key (required for Synthetics App)' },
                },
              ],
            },
          },
          sort: { field: 'creation', direction: 'desc' },
          size: 25,
          filters: {},
        },
        responseType: 'json',
      });
      expect(res).toHaveStatusCode(200);
      const body = res.body as { apiKeys?: ApiKey[] };
      return (body.apiKeys ?? []).filter(
        (apiKey) => apiKey.name.includes('synthetics-api-key') && apiKey.invalidated === false
      );
    };

    const putEnablement = (apiClient: any, headers: Record<string, string>, spacePrefix = '') =>
      apiClient.put(
        `${spacePrefix}${SYNTHETICS_API_URLS.SYNTHETICS_ENABLEMENT}`.replace(/^\//, ''),
        { headers, responseType: 'json' }
      );

    const deleteEnablement = (apiClient: any, headers: Record<string, string>, spacePrefix = '') =>
      apiClient.delete(
        `${spacePrefix}${SYNTHETICS_API_URLS.SYNTHETICS_ENABLEMENT}`.replace(/^\//, ''),
        { headers }
      );

    const expectSyntheticsWriterPrivileges = (apiKey: ApiKey) => {
      // Subset assertion: serverless omits `read_ilm` from cluster privileges.
      // Scout's API `expect` has no `toEqual`, so assert each expected
      // cluster privilege is present via `toContain`.
      for (const priv of COMMON_SYNTHETICS_WRITER_CLUSTER_PRIVS) {
        expect(apiKey.role_descriptors.synthetics_writer.cluster).toContain(priv);
      }
      expect(apiKey.role_descriptors.synthetics_writer.indices).toStrictEqual(
        SYNTHETICS_WRITER_INDICES
      );
    };

    // Flat suite (no nested `describe`s to satisfy playwright/max-nested-describe);
    // `[PUT]` / `[DELETE]` prefixes preserve the grouping from the original FTR spec.
    apiTest.beforeEach(async ({ apiClient, samlAuth }) => {
      const { cookieHeader } = await samlAuth.asInteractiveUser('admin');
      const adminHeaders = { ...KIBANA_HEADERS, ...cookieHeader };
      const apiKeys = await fetchApiKeys(apiClient, adminHeaders);
      if (apiKeys.length) {
        await deleteEnablement(apiClient, adminHeaders);
      }
    });

    apiTest(
      '[PUT] returns response when user cannot manage api keys',
      async ({ apiClient, samlAuth }) => {
        const { cookieHeader } = await samlAuth.asInteractiveUser('editor');
        const headers = { ...KIBANA_HEADERS, ...cookieHeader };
        const res = await putEnablement(apiClient, headers);
        expect(res).toHaveStatusCode(200);
        expect(res.body).toStrictEqual(DISABLED_RESPONSE_EDITOR);
      }
    );

    apiTest(
      '[PUT] returns response for an admin with privilege',
      async ({ apiClient, samlAuth }) => {
        const { cookieHeader } = await samlAuth.asInteractiveUser('admin');
        const adminHeaders = { ...KIBANA_HEADERS, ...cookieHeader };
        const res = await putEnablement(apiClient, adminHeaders);
        expect(res).toHaveStatusCode(200);
        expect(res.body).toStrictEqual(ENABLED_RESPONSE_ADMIN);
        const validApiKeys = await fetchApiKeys(apiClient, adminHeaders);
        expect(validApiKeys).toHaveLength(1);
        expectSyntheticsWriterPrivileges(validApiKeys[0]);
      }
    );

    apiTest('[PUT] does not create excess api keys', async ({ apiClient, samlAuth }) => {
      const { cookieHeader } = await samlAuth.asInteractiveUser('admin');
      const adminHeaders = { ...KIBANA_HEADERS, ...cookieHeader };

      const first = await putEnablement(apiClient, adminHeaders);
      expect(first).toHaveStatusCode(200);
      const afterFirst = await fetchApiKeys(apiClient, adminHeaders);
      expect(afterFirst).toHaveLength(1);
      expectSyntheticsWriterPrivileges(afterFirst[0]);

      const second = await putEnablement(apiClient, adminHeaders);
      expect(second).toHaveStatusCode(200);
      const afterSecond = await fetchApiKeys(apiClient, adminHeaders);
      expect(afterSecond).toHaveLength(1);
      expectSyntheticsWriterPrivileges(afterSecond[0]);
    });

    apiTest('[PUT] auto re-enables api key when invalidated', async ({ apiClient, samlAuth }) => {
      const { cookieHeader } = await samlAuth.asInteractiveUser('admin');
      const adminHeaders = { ...KIBANA_HEADERS, ...cookieHeader };

      const enable = await putEnablement(apiClient, adminHeaders);
      expect(enable).toHaveStatusCode(200);

      const valid = await fetchApiKeys(apiClient, adminHeaders);
      expect(valid).toHaveLength(1);
      expectSyntheticsWriterPrivileges(valid[0]);

      const invalidate = await apiClient.post('internal/security/api_key/invalidate', {
        headers: adminHeaders,
        body: {
          apiKeys: valid.map(({ id, name }) => ({ id, name })),
          isAdmin: true,
        },
        responseType: 'json',
      });
      expect(invalidate).toHaveStatusCode(200);
      expect(await fetchApiKeys(apiClient, adminHeaders)).toHaveLength(0);

      const reEnable = await putEnablement(apiClient, adminHeaders);
      expect(reEnable).toHaveStatusCode(200);

      const recreated = await fetchApiKeys(apiClient, adminHeaders);
      expect(recreated).toHaveLength(1);
      expectSyntheticsWriterPrivileges(recreated[0]);
    });

    apiTest(
      '[PUT] returns response for an uptime all user without admin privileges',
      async ({ apiClient, samlAuth }) => {
        const { cookieHeader } = await samlAuth.asInteractiveUser('editor');
        const headers = { ...KIBANA_HEADERS, ...cookieHeader };
        const res = await putEnablement(apiClient, headers);
        expect(res).toHaveStatusCode(200);
        expect(res.body).toStrictEqual(DISABLED_RESPONSE_EDITOR);
      }
    );

    apiTest('[DELETE] is idempotent when already disabled', async ({ apiClient, samlAuth }) => {
      const { cookieHeader } = await samlAuth.asInteractiveUser('admin');
      const adminHeaders = { ...KIBANA_HEADERS, ...cookieHeader };
      const res = await deleteEnablement(apiClient, adminHeaders);
      expect(res).toHaveStatusCode(200);
      expect(res.body).toStrictEqual({});
    });

    apiTest(
      '[DELETE] is idempotent across consecutive deletes',
      async ({ apiClient, samlAuth }) => {
        const { cookieHeader } = await samlAuth.asInteractiveUser('admin');
        const adminHeaders = { ...KIBANA_HEADERS, ...cookieHeader };

        expect(await putEnablement(apiClient, adminHeaders)).toHaveStatusCode(200);
        const firstDelete = await deleteEnablement(apiClient, adminHeaders);
        expect(firstDelete).toHaveStatusCode(200);
        expect(firstDelete.body).toStrictEqual({});
        const secondDelete = await deleteEnablement(apiClient, adminHeaders);
        expect(secondDelete).toHaveStatusCode(200);
        expect(secondDelete.body).toStrictEqual({});
      }
    );

    apiTest('[DELETE] with an admin', async ({ apiClient, samlAuth }) => {
      const { cookieHeader } = await samlAuth.asInteractiveUser('admin');
      const adminHeaders = { ...KIBANA_HEADERS, ...cookieHeader };
      expect(await putEnablement(apiClient, adminHeaders)).toHaveStatusCode(200);
      const del = await deleteEnablement(apiClient, adminHeaders);
      expect(del).toHaveStatusCode(200);
      expect(del.body).toStrictEqual({});
      const reEnable = await putEnablement(apiClient, adminHeaders);
      expect(reEnable).toHaveStatusCode(200);
      expect(reEnable.body).toStrictEqual(ENABLED_RESPONSE_ADMIN);
    });

    apiTest('[DELETE] with an uptime user', async ({ apiClient, samlAuth }) => {
      const { cookieHeader: adminCookie } = await samlAuth.asInteractiveUser('admin');
      const adminHeaders = { ...KIBANA_HEADERS, ...adminCookie };
      const { cookieHeader: editorCookie } = await samlAuth.asInteractiveUser('editor');
      const editorHeaders = { ...KIBANA_HEADERS, ...editorCookie };

      expect(await putEnablement(apiClient, adminHeaders)).toHaveStatusCode(200);
      expect(await deleteEnablement(apiClient, editorHeaders)).toHaveStatusCode(403);

      const editorPut = await putEnablement(apiClient, editorHeaders);
      expect(editorPut).toHaveStatusCode(200);
      expect(editorPut.body).toStrictEqual(ENABLED_RESPONSE_EDITOR);
    });

    apiTest('[DELETE] is space agnostic', async ({ apiClient, samlAuth, kbnClient }) => {
      const { cookieHeader } = await samlAuth.asInteractiveUser('admin');
      const adminHeaders = { ...KIBANA_HEADERS, ...cookieHeader };
      const SPACE_ID = `test-space-${uuidv4()}`;
      const SPACE_NAME = `test-space-name-${uuidv4()}`;
      await kbnClient.spaces.create({ id: SPACE_ID, name: SPACE_NAME });

      try {
        const enableInSpace = await putEnablement(apiClient, adminHeaders, `/s/${SPACE_ID}`);
        expect(enableInSpace).toHaveStatusCode(200);
        expect(enableInSpace.body).toStrictEqual(ENABLED_RESPONSE_ADMIN);

        expect(await putEnablement(apiClient, adminHeaders, `/s/${SPACE_ID}`)).toHaveStatusCode(
          200
        );
        expect(await deleteEnablement(apiClient, adminHeaders)).toHaveStatusCode(200);
        expect(await putEnablement(apiClient, adminHeaders)).toHaveStatusCode(200);

        expect(await putEnablement(apiClient, adminHeaders)).toHaveStatusCode(200);
        expect(await deleteEnablement(apiClient, adminHeaders, `/s/${SPACE_ID}`)).toHaveStatusCode(
          200
        );
        const enableDefault = await putEnablement(apiClient, adminHeaders);
        expect(enableDefault).toHaveStatusCode(200);
        expect(enableDefault.body).toStrictEqual(ENABLED_RESPONSE_ADMIN);
      } finally {
        try {
          await kbnClient.spaces.delete(SPACE_ID);
        } catch {
          // best-effort; ignore if already deleted
        }
      }
    });
  }
);
