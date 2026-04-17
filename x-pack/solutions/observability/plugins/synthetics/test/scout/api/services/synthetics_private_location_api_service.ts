/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { KbnClient } from '@kbn/scout-oblt';

export const DEFAULT_SYNTHETICS_VERSION = '1.5.0';

export interface ScoutPrivateLocation {
  id: string;
  label: string;
  agentPolicyId: string;
  geo: { lat: number; lon: number };
  isServiceManaged: false;
}

/**
 * Worker-scoped helpers for the Synthetics Fleet package and private-location
 * saved objects. Intended for Scout API test `beforeAll`/`afterAll` setup —
 * not for the HTTP calls under test. All requests go through `kbnClient`
 * (elevated privileges).
 *
 * Idempotent package installs and a cached shared private location are kept
 * worker-local so one install/location is reused across specs on the same
 * worker.
 */
export interface SyntheticsPrivateLocationApi {
  fetchSyntheticsPackageVersion(): Promise<string>;
  installSyntheticsPackage(opts?: { version?: string }): Promise<void>;
  resetInstalledVersionCache(): void;
  addFleetPolicy(name: string, spaceIds?: string[]): Promise<{ id: string }>;
  setTestLocations(
    testFleetPolicyIds: string[],
    spaceId?: string | string[]
  ): Promise<ScoutPrivateLocation[]>;
  addTestPrivateLocation(spaceId?: string): Promise<ScoutPrivateLocation>;
  getSharedPrivateLocation(): Promise<ScoutPrivateLocation>;
  resetSharedPrivateLocation(): void;
  cleanUpPrivateLocationsAndPolicies(): Promise<void>;
}

export function createSyntheticsPrivateLocationApi(
  kbnClient: KbnClient
): SyntheticsPrivateLocationApi {
  let cachedInstalledVersion: string | null = null;
  let cachedSharedLocation: ScoutPrivateLocation | null = null;

  const fetchSyntheticsPackageVersion = async (): Promise<string> => {
    const { data } = await kbnClient.request<{ item?: { version: string } }>({
      path: '/api/fleet/epm/packages/synthetics',
      method: 'GET',
    });
    return data?.item?.version ?? DEFAULT_SYNTHETICS_VERSION;
  };

  const installSyntheticsPackage = async ({ version }: { version?: string } = {}) => {
    const resolvedVersion = version ?? (await fetchSyntheticsPackageVersion());

    if (cachedInstalledVersion === resolvedVersion) {
      return;
    }

    await kbnClient.request({ path: '/api/fleet/setup', method: 'POST' });

    await kbnClient.request({ path: '/api/fleet/epm/packages/synthetics', method: 'DELETE' });
    await kbnClient.request({
      path: `/api/fleet/epm/packages/synthetics/${resolvedVersion}`,
      method: 'POST',
      body: { force: true },
    });

    const { data } = await kbnClient.request<{ item?: { version: string } }>({
      path: '/api/fleet/epm/packages/synthetics',
      method: 'GET',
    });
    const installedVersion = data?.item?.version ?? DEFAULT_SYNTHETICS_VERSION;
    if (installedVersion !== resolvedVersion) {
      throw new Error(
        `Package version mismatch after install: expected ${resolvedVersion} but got ${installedVersion}`
      );
    }

    cachedInstalledVersion = resolvedVersion;
  };

  const resetInstalledVersionCache = () => {
    cachedInstalledVersion = null;
  };

  const addFleetPolicy = async (name: string, spaceIds: string[] = ['default']) => {
    const prefix = spaceIds[0] !== 'default' ? `/s/${spaceIds[0]}` : '';
    const { data } = await kbnClient.request<{ item: { id: string } }>({
      path: `${prefix}/api/fleet/agent_policies?sys_monitoring=true`,
      method: 'POST',
      body: {
        name,
        description: '',
        namespace: 'default',
        monitoring_enabled: [],
        space_ids: spaceIds.length > 1 ? spaceIds : undefined,
      },
    });
    return { id: data.item.id };
  };

  const setTestLocations = async (
    testFleetPolicyIds: string[],
    spaceId?: string | string[]
  ): Promise<ScoutPrivateLocation[]> => {
    const locations: ScoutPrivateLocation[] = testFleetPolicyIds.map((id) => ({
      id,
      label: `Test private location ${id}`,
      agentPolicyId: id,
      geo: { lat: 0, lon: 0 },
      isServiceManaged: false,
    }));
    const urlSpaceId = spaceId ? (Array.isArray(spaceId) ? spaceId[0] : spaceId) : 'default';
    const initialNamespaces = spaceId
      ? Array.isArray(spaceId)
        ? spaceId
        : [spaceId]
      : ['default'];

    await kbnClient.request({
      path: `/s/${urlSpaceId}/api/saved_objects/_bulk_create`,
      method: 'POST',
      body: locations.map((location) => ({
        type: 'synthetics-privates-locations',
        id: location.id,
        attributes: location,
        initialNamespaces,
      })),
    });
    return locations;
  };

  const addTestPrivateLocation = async (
    spaceId: string = 'default'
  ): Promise<ScoutPrivateLocation> => {
    await installSyntheticsPackage();
    const { id: policyId } = await addFleetPolicy(`Scout test policy ${Date.now()}`, [spaceId]);
    const [location] = await setTestLocations([policyId], spaceId);
    return location;
  };

  const getSharedPrivateLocation = async (): Promise<ScoutPrivateLocation> => {
    if (cachedSharedLocation) {
      return cachedSharedLocation;
    }
    cachedSharedLocation = await addTestPrivateLocation();
    return cachedSharedLocation;
  };

  const resetSharedPrivateLocation = () => {
    cachedSharedLocation = null;
  };

  const cleanUpPrivateLocationsAndPolicies = async () => {
    await kbnClient.savedObjects.clean({
      types: ['synthetics-privates-locations', 'ingest-agent-policies', 'ingest-package-policies'],
    });
    cachedSharedLocation = null;
  };

  return {
    fetchSyntheticsPackageVersion,
    installSyntheticsPackage,
    resetInstalledVersionCache,
    addFleetPolicy,
    setTestLocations,
    addTestPrivateLocation,
    getSharedPrivateLocation,
    resetSharedPrivateLocation,
    cleanUpPrivateLocationsAndPolicies,
  };
}
