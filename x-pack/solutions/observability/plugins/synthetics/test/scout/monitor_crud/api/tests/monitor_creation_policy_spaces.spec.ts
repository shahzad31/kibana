/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KbnClient, KibanaRole } from '@kbn/scout-oblt';
import { expect } from '@kbn/scout-oblt/api';
import { apiTest, KIBANA_HEADERS, SYNTHETICS_API_URLS } from '../../../common/fixtures';

const SO_TYPE = 'synthetics-settings-multi-space';
const CCS_ID = 'synthetics-settings-multi-space-ccs';
const POLICY_ID = 'synthetics-settings-multi-space-monitor-policy';
const SECOND_SPACE_ID = 'policy-ccs-overlap-space';
const ALL_SPACES = '*';

interface CcsSettingsResponse {
  useAllRemoteClusters: boolean;
  selectedRemoteClusters: string[];
  spaces: string[];
}

interface PolicyResponse {
  allowedMonitorTypes: string[];
  minimumMonitorFrequency: string;
  spaces: string[];
}

interface FindResponse {
  total: number;
  saved_objects: Array<{ id: string; namespaces?: string[] }>;
}

const POLICY_MANAGER_ROLE: KibanaRole = {
  elasticsearch: { cluster: [], indices: [] },
  kibana: [
    {
      base: [],
      feature: { uptime: ['all', 'can_manage_monitor_policy'] },
      spaces: ['*'],
    },
  ],
};

const spaceUrl = (path: string, spaceId?: string) =>
  `${spaceId ? `s/${spaceId}/` : ''}${path.replace(/^\//, '')}`;

const ccsUrl = (spaceId?: string) => spaceUrl(SYNTHETICS_API_URLS.MULTI_SPACE_SETTINGS, spaceId);
const policyUrl = (spaceId?: string) => spaceUrl(SYNTHETICS_API_URLS.MONITOR_TYPES_POLICY, spaceId);

const sorted = (values: string[] | undefined): string[] => [...(values ?? [])].sort();

const cleanSettings = async (kbnClient: KbnClient) => {
  const { data } = await kbnClient.request<FindResponse>({
    method: 'GET',
    path: '/api/saved_objects/_find',
    query: { type: SO_TYPE, per_page: 100, namespaces: ALL_SPACES },
  });
  await Promise.all(
    data.saved_objects.map(({ id, namespaces }) => {
      const namespace = namespaces?.find((ns) => ns !== ALL_SPACES);
      const spacePrefix = namespace && namespace !== 'default' ? `s/${namespace}/` : '';
      return kbnClient
        .request({
          method: 'DELETE',
          path: `${spacePrefix}api/saved_objects/${SO_TYPE}/${id}`,
          query: { force: true },
        })
        .catch(() => {});
    })
  );
};

const findSettingsAcrossSpaces = async (kbnClient: KbnClient): Promise<FindResponse> => {
  const { data } = await kbnClient.request<FindResponse>({
    method: 'GET',
    path: '/api/saved_objects/_find',
    query: { type: SO_TYPE, per_page: 100, namespaces: ALL_SPACES },
  });
  return data;
};

const namespacesById = (find: FindResponse): Record<string, string[]> =>
  Object.fromEntries(find.saved_objects.map((object) => [object.id, sorted(object.namespaces)]));

apiTest.describe(
  'Synthetics CCS and monitor-policy space sharing',
  // CCS settings 404 on serverless; overlap coverage needs both endpoints.
  { tag: ['@local-stateful-classic'] },
  () => {
    let editorHeaders: Record<string, string>;
    let policyHeaders: Record<string, string>;

    apiTest.beforeAll(async ({ samlAuth, kbnClient }) => {
      const { cookieHeader: editorCookie } = await samlAuth.asInteractiveUser('editor');
      editorHeaders = { ...KIBANA_HEADERS, ...editorCookie };
      const { cookieHeader: policyCookie } = await samlAuth.asInteractiveUser(POLICY_MANAGER_ROLE);
      policyHeaders = { ...KIBANA_HEADERS, ...policyCookie };
      await kbnClient.spaces
        .create({ id: SECOND_SPACE_ID, name: 'Policy CCS overlap space' })
        .catch(() => {});
    });

    apiTest.beforeEach(async ({ kbnClient }) => {
      await cleanSettings(kbnClient);
    });

    apiTest.afterAll(async ({ kbnClient }) => {
      await cleanSettings(kbnClient);
      await kbnClient.spaces.delete(SECOND_SPACE_ID).catch(() => {});
    });

    apiTest(
      'saving CCS spaces as a monitor writer does not rewrite policy spaces',
      async ({ apiClient, kbnClient }) => {
        const policyPut = await apiClient.put(policyUrl(), {
          headers: policyHeaders,
          body: {
            allowedMonitorTypes: ['http'],
            minimumMonitorFrequency: '3',
            spaces: ['default', SECOND_SPACE_ID],
          },
          responseType: 'json',
        });
        expect(policyPut).toHaveStatusCode(200);

        const ccsPut = await apiClient.put(ccsUrl(), {
          headers: editorHeaders,
          body: {
            useAllRemoteClusters: true,
            selectedRemoteClusters: ['cluster_a'],
            spaces: ['default'],
          },
          responseType: 'json',
        });
        expect(ccsPut).toHaveStatusCode(200);

        const policyGet = await apiClient.get(policyUrl(), {
          headers: editorHeaders,
          responseType: 'json',
        });
        expect(policyGet).toHaveStatusCode(200);
        expect(policyGet.body as PolicyResponse).toMatchObject({
          allowedMonitorTypes: ['http'],
          minimumMonitorFrequency: '3',
        });
        expect(sorted((policyGet.body as PolicyResponse).spaces)).toStrictEqual(
          sorted(['default', SECOND_SPACE_ID])
        );

        const find = await findSettingsAcrossSpaces(kbnClient);
        expect(sorted(find.saved_objects.map((object) => object.id))).toStrictEqual(
          sorted([CCS_ID, POLICY_ID])
        );
        expect(namespacesById(find)[POLICY_ID]).toStrictEqual(sorted(['default', SECOND_SPACE_ID]));
        expect(namespacesById(find)[CCS_ID]).toStrictEqual(['default']);
      }
    );

    apiTest(
      'saving policy spaces does not rewrite CCS spaces',
      async ({ apiClient, kbnClient }) => {
        const ccsPut = await apiClient.put(ccsUrl(), {
          headers: editorHeaders,
          body: {
            useAllRemoteClusters: true,
            selectedRemoteClusters: ['cluster_a'],
            spaces: ['default', SECOND_SPACE_ID],
          },
          responseType: 'json',
        });
        expect(ccsPut).toHaveStatusCode(200);

        const policyPut = await apiClient.put(policyUrl(), {
          headers: policyHeaders,
          body: {
            allowedMonitorTypes: ['tcp'],
            minimumMonitorFrequency: '5',
            spaces: ['default'],
          },
          responseType: 'json',
        });
        expect(policyPut).toHaveStatusCode(200);

        const ccsGet = await apiClient.get(ccsUrl(), {
          headers: editorHeaders,
          responseType: 'json',
        });
        expect(ccsGet).toHaveStatusCode(200);
        expect(ccsGet.body as CcsSettingsResponse).toMatchObject({
          useAllRemoteClusters: true,
          selectedRemoteClusters: ['cluster_a'],
        });
        expect(sorted((ccsGet.body as CcsSettingsResponse).spaces)).toStrictEqual(
          sorted(['default', SECOND_SPACE_ID])
        );

        const find = await findSettingsAcrossSpaces(kbnClient);
        expect(namespacesById(find)[CCS_ID]).toStrictEqual(sorted(['default', SECOND_SPACE_ID]));
        expect(namespacesById(find)[POLICY_ID]).toStrictEqual(['default']);
      }
    );

    apiTest(
      'each document is visible only in the spaces it is shared with',
      async ({ apiClient }) => {
        const ccsPut = await apiClient.put(ccsUrl(), {
          headers: editorHeaders,
          body: {
            useAllRemoteClusters: true,
            selectedRemoteClusters: ['cluster_a'],
            spaces: ['default'],
          },
          responseType: 'json',
        });
        expect(ccsPut).toHaveStatusCode(200);

        const policyPut = await apiClient.put(policyUrl(), {
          headers: policyHeaders,
          body: {
            allowedMonitorTypes: ['browser'],
            minimumMonitorFrequency: '10',
            spaces: [SECOND_SPACE_ID],
          },
          responseType: 'json',
        });
        expect(policyPut).toHaveStatusCode(200);

        const ccsInDefault = await apiClient.get(ccsUrl(), {
          headers: editorHeaders,
          responseType: 'json',
        });
        expect(ccsInDefault.body as CcsSettingsResponse).toMatchObject({
          useAllRemoteClusters: true,
          selectedRemoteClusters: ['cluster_a'],
          spaces: ['default'],
        });

        const ccsInOther = await apiClient.get(ccsUrl(SECOND_SPACE_ID), {
          headers: editorHeaders,
          responseType: 'json',
        });
        expect(ccsInOther.body as CcsSettingsResponse).toMatchObject({
          useAllRemoteClusters: false,
          selectedRemoteClusters: [],
          spaces: [SECOND_SPACE_ID],
        });

        const policyInDefault = await apiClient.get(policyUrl(), {
          headers: editorHeaders,
          responseType: 'json',
        });
        expect(policyInDefault.body as PolicyResponse).toMatchObject({
          allowedMonitorTypes: [],
          minimumMonitorFrequency: '',
          spaces: ['default'],
        });

        const policyInOther = await apiClient.get(policyUrl(SECOND_SPACE_ID), {
          headers: editorHeaders,
          responseType: 'json',
        });
        expect(policyInOther.body as PolicyResponse).toMatchObject({
          allowedMonitorTypes: ['browser'],
          minimumMonitorFrequency: '10',
        });
        expect(sorted((policyInOther.body as PolicyResponse).spaces)).toStrictEqual([
          SECOND_SPACE_ID,
        ]);
      }
    );

    apiTest(
      'unpinning overlapping CCS spaces leaves the policy shared with the dropped space',
      async ({ apiClient }) => {
        const ccsPut = await apiClient.put(ccsUrl(), {
          headers: editorHeaders,
          body: {
            useAllRemoteClusters: true,
            selectedRemoteClusters: ['cluster_a'],
            spaces: ['default', SECOND_SPACE_ID],
          },
          responseType: 'json',
        });
        expect(ccsPut).toHaveStatusCode(200);

        const policyPut = await apiClient.put(policyUrl(), {
          headers: policyHeaders,
          body: {
            allowedMonitorTypes: ['http', 'tcp'],
            minimumMonitorFrequency: '1',
            spaces: ['default', SECOND_SPACE_ID],
          },
          responseType: 'json',
        });
        expect(policyPut).toHaveStatusCode(200);

        const ccsPinned = await apiClient.put(ccsUrl(), {
          headers: editorHeaders,
          body: {
            useAllRemoteClusters: true,
            selectedRemoteClusters: ['cluster_a'],
            spaces: ['default'],
          },
          responseType: 'json',
        });
        expect(ccsPinned).toHaveStatusCode(200);
        expect((ccsPinned.body as CcsSettingsResponse).spaces).toStrictEqual(['default']);

        const policyInOther = await apiClient.get(policyUrl(SECOND_SPACE_ID), {
          headers: editorHeaders,
          responseType: 'json',
        });
        expect(policyInOther).toHaveStatusCode(200);
        expect(policyInOther.body as PolicyResponse).toMatchObject({
          allowedMonitorTypes: ['http', 'tcp'],
          minimumMonitorFrequency: '1',
        });
        expect(sorted((policyInOther.body as PolicyResponse).spaces)).toStrictEqual(
          sorted(['default', SECOND_SPACE_ID])
        );

        const ccsInOther = await apiClient.get(ccsUrl(SECOND_SPACE_ID), {
          headers: editorHeaders,
          responseType: 'json',
        });
        expect(ccsInOther.body as CcsSettingsResponse).toMatchObject({
          useAllRemoteClusters: false,
          selectedRemoteClusters: [],
          spaces: [SECOND_SPACE_ID],
        });
      }
    );
  }
);
