/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createTestConfig } from '../common/config';

export default createTestConfig('security_and_spaces', {
  license: 'basic',
  testFiles: [require.resolve('./apis'), require.resolve('./apis/get_all')],
});
