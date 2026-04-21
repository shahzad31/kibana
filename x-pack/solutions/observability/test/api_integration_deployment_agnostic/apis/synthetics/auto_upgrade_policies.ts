/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import semver from 'semver';
import { v4 as uuidv4 } from 'uuid';
import type { RoleCredentials } from '@kbn/ftr-common-functional-services';
import type { HTTPFields } from '@kbn/synthetics-plugin/common/runtime_types';
import { ConfigKey } from '@kbn/synthetics-plugin/common/runtime_types';
import { SYNTHETICS_API_URLS } from '@kbn/synthetics-plugin/common/constants';
import type { PackagePolicy } from '@kbn/fleet-plugin/common';
import expect from '@kbn/expect';
import type { DeploymentAgnosticFtrProviderContext } from '../../ftr_provider_context';
import { getFixtureJson } from './helpers/get_fixture_json';
import {
  PrivateLocationTestService,
  cleanSyntheticsTestData,
} from '../../services/synthetics_private_location';
import { SyntheticsMonitorTestService } from '../../services/synthetics_monitor';

export default function ({ getService }: DeploymentAgnosticFtrProviderContext) {
  describe('AutoUpgradePolicies', function () {
    const kibanaServer = getService('kibanaServer');
    const supertestWithoutAuth = getService('supertestWithoutAuth');
    // TODO: Replace with roleScopedSupertest for deployment-agnostic compatibility
    // eslint-disable-next-line @kbn/eslint/deployment_agnostic_test_context
    const supertestWithAuth = getService('supertest');
    const samlAuth = getService('samlAuth');
    const retry = getService('retry');

    let editorUser: RoleCredentials;
    let httpMonitorJson: HTTPFields;
    const monitorTestService = new SyntheticsMonitorTestService(getService);
    const testPrivateLocations = new PrivateLocationTestService(getService);

    before(async () => {
      await cleanSyntheticsTestData(kibanaServer);
      editorUser = await samlAuth.createM2mApiKeyWithRoleScope('editor');
      httpMonitorJson = getFixtureJson('http_monitor');
    });

    after(async () => {
      await cleanSyntheticsTestData(kibanaServer);
    });

    it('handles auto upgrading policies', async function () {
      const lowerVersion = '1.1.1';

      const pkgCheck = await supertestWithAuth
        .get(`/api/fleet/epm/packages/synthetics/${lowerVersion}`)
        .set('kbn-xsrf', 'true');
      if (pkgCheck.status === 404) {
        this.skip();
      }

      await testPrivateLocations.installSyntheticsPackage({
        version: lowerVersion,
        force: true,
      });
      let monitorId = '';
      const privateLocation = await testPrivateLocations.addTestPrivateLocation();

      const monitor = {
        ...httpMonitorJson,
        name: `Test monitor ${uuidv4()}`,
        [ConfigKey.NAMESPACE]: 'default',
        locations: [],
        private_locations: [privateLocation.id],
      };

      try {
        const apiResponse = await supertestWithoutAuth
          .post(SYNTHETICS_API_URLS.SYNTHETICS_MONITORS)
          .set(editorUser.apiKeyHeader)
          .set(samlAuth.getInternalRequestHeader())
          .send(monitor);

        expect(apiResponse.status).eql(200, JSON.stringify(apiResponse.body));

        monitorId = apiResponse.body.id;

        const policyResponse = await supertestWithAuth.get(
          '/api/fleet/package_policies?page=1&perPage=2000&kuery=ingest-package-policies.package.name%3A%20synthetics'
        );

        const packagePolicy = policyResponse.body.items.find(
          (pkgPolicy: PackagePolicy) => pkgPolicy.id === monitorId + '-' + privateLocation.id
        );

        expect(packagePolicy.package.version).eql(lowerVersion);

        await testPrivateLocations.installSyntheticsPackage({ force: true });

        // Trigger Fleet setup which runs setupUpgradeManagedPackagePolicies
        // to upgrade policies for packages with keep_policies_up_to_date.
        await supertestWithAuth.post('/api/fleet/setup').set('kbn-xsrf', 'true').expect(200);

        await retry.tryForTime(120 * 1000, async () => {
          const policyResponseAfterUpgrade = await supertestWithAuth.get(
            '/api/fleet/package_policies?page=1&perPage=2000&kuery=ingest-package-policies.package.name%3A%20synthetics'
          );
          const packagePolicyAfterUpgrade = policyResponseAfterUpgrade.body.items.find(
            (pkgPolicy: PackagePolicy) => pkgPolicy.id === monitorId + '-' + privateLocation.id
          );
          expect(semver.gt(packagePolicyAfterUpgrade.package.version, lowerVersion)).eql(
            true,
            `Expected ${packagePolicyAfterUpgrade.package.version} to be greater than ${lowerVersion}`
          );
        });
      } finally {
        try {
          await monitorTestService.deleteMonitor(editorUser, monitorId);
        } catch (e) {
          // ignore cleanup errors
        }
        await testPrivateLocations.installSyntheticsPackage({ force: true });
      }
    });
  });
}
