/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Journey } from '@kbn/journeys';
import expect from '@kbn/expect';
import { waitForChrome } from '../utils';

const fetchListWithCount: Record<string, number> = {
  'http://localhost:5620/translations/en.json': 1,
  'http://localhost:5620/internal/security/me': 3,
  'http://localhost:5620/api/core/capabilities': 1,
  'http://localhost:5620/api/licensing/info': 2,
  'http://localhost:5620/api/banners/info': 1,
  'http://localhost:5620/internal/security/session': 1,
  'http://localhost:5620/internal/security/user_profile?dataPath=avatar': 1,
  'https://kibana-ops-e2e-perf.apm.us-central1.gcp.cloud.es.io/intake/v2/rum/events': NaN,
  'http://localhost:5620/internal/spaces/_active_space': 1,
  'http://localhost:5620/internal/licensing/feature_usage/register': 1,
  'http://localhost:5620/internal/security/analytics/_record_auth_type': 1,
  'http://localhost:5620/api/saved_objects_tagging/tags': 1,
  'http://localhost:5620/api/saved_objects/_bulk_get': 1,
  'http://localhost:5620/api/index_patterns/has_user_index_pattern': 1,
  'http://localhost:5620/api/telemetry/v2/userHasSeenNotice': 1,
};

export const journey = new Journey().step(
  'Go to Homepage',
  async ({ page, kbnUrl, inputDelays }) => {
    const fetchListOfPage: Record<string, number> = {};

    page.on('request', (evt) => {
      if (evt.resourceType() === 'fetch' && !evt.url().includes('_newsfeed')) {
        fetchListOfPage[evt.url()] = fetchListOfPage[evt.url()] + 1 || 1;
        if (isNaN(fetchListWithCount[evt.url()])) {
          fetchListOfPage[evt.url()] = NaN;
        }
      }
    });
    await page.goto(kbnUrl.get(`/app/home`), { waitUntil: 'networkidle' });

    await waitForChrome(page);

    await page.waitForTimeout(5 * 1000);

    expect(JSON.stringify(fetchListOfPage)).equal(JSON.stringify(fetchListWithCount));
  }
);
