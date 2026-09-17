/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SavedObjectsClientContract } from '@kbn/core-saved-objects-api-server';
import { savedObjectsClientMock } from '@kbn/core-saved-objects-api-server-mocks';
import { ALL_SPACES_ID } from '@kbn/spaces-plugin/common/constants';
import {
  SYNTHETICS_SETTINGS_MULTI_SPACE_CCS_ID,
  SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
  SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
} from '../saved_objects/synthetics_settings_multi_space';
import {
  DEFAULT_MONITOR_CREATION_POLICY,
  DefaultSyntheticsMonitorCreationPolicyRepository,
} from './synthetics_monitor_creation_policy_repository';

const FIND_OPTIONS = {
  type: SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
  perPage: 100,
  namespaces: [ALL_SPACES_ID],
};

const buildEmptyFindResponse = () => ({
  saved_objects: [],
  total: 0,
  per_page: 100,
  page: 1,
});

const buildFindResponseWith = (
  id: string,
  attributes: Record<string, unknown>,
  namespaces: string[] = ['default']
) => ({
  saved_objects: [
    {
      id,
      type: SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
      attributes,
      namespaces,
      references: [],
      score: 0,
    },
  ],
  total: 1,
  per_page: 100,
  page: 1,
});

describe('DefaultSyntheticsMonitorCreationPolicyRepository', () => {
  let soClient: jest.Mocked<SavedObjectsClientContract>;
  let repository: DefaultSyntheticsMonitorCreationPolicyRepository;

  beforeEach(() => {
    soClient = savedObjectsClientMock.create();
    soClient.asScopedToNamespace.mockImplementation(() => soClient);
    repository = new DefaultSyntheticsMonitorCreationPolicyRepository(soClient);
  });

  it('creates the policy document with its own id on the shared type', async () => {
    soClient.find.mockResolvedValueOnce(buildEmptyFindResponse());
    soClient.create.mockResolvedValueOnce({} as any);

    await repository.save({ allowedMonitorTypes: ['http'] }, ['marketing']);

    expect(soClient.find).toHaveBeenCalledWith(FIND_OPTIONS);
    expect(soClient.create).toHaveBeenCalledWith(
      SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
      {
        allowedMonitorTypes: ['http'],
        minimumMonitorFrequency: '',
      },
      {
        id: SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
        initialNamespaces: ['marketing'],
      }
    );
  });

  it('returns defaults when only the CCS document exists', async () => {
    soClient.find.mockResolvedValueOnce(
      buildFindResponseWith(
        SYNTHETICS_SETTINGS_MULTI_SPACE_CCS_ID,
        { useAllRemoteClusters: true, selectedRemoteClusters: ['cluster-a'] },
        ['default']
      )
    );
    soClient.getCurrentNamespace.mockReturnValue('default');

    const result = await repository.get();

    expect(result).toEqual({ ...DEFAULT_MONITOR_CREATION_POLICY, spaces: ['default'] });
  });

  it('returns defaults with the current space when no document exists', async () => {
    soClient.find.mockResolvedValueOnce(buildEmptyFindResponse());
    soClient.getCurrentNamespace.mockReturnValue('marketing');

    const result = await repository.get();

    expect(result).toEqual({ ...DEFAULT_MONITOR_CREATION_POLICY, spaces: ['marketing'] });
  });

  it('returns stored policy and namespaces when the policy document exists', async () => {
    soClient.find.mockResolvedValueOnce(
      buildFindResponseWith(
        SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
        { allowedMonitorTypes: ['http'], minimumMonitorFrequency: '3' },
        ['default', 'marketing']
      )
    );
    soClient.getCurrentNamespace.mockReturnValue('default');

    const result = await repository.get();

    expect(result).toEqual({
      allowedMonitorTypes: ['http'],
      minimumMonitorFrequency: '3',
      spaces: ['default', 'marketing'],
    });
  });

  it('returns defaults in spaces where the policy document is not visible', async () => {
    soClient.find.mockResolvedValueOnce(
      buildFindResponseWith(
        SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
        { allowedMonitorTypes: ['http'], minimumMonitorFrequency: '3' },
        ['default']
      )
    );
    soClient.getCurrentNamespace.mockReturnValue('marketing');

    const result = await repository.get();

    expect(result).toEqual({ ...DEFAULT_MONITOR_CREATION_POLICY, spaces: ['marketing'] });
  });

  it('preserves a stored minimum frequency when only allowed types are saved', async () => {
    soClient.find.mockResolvedValueOnce(
      buildFindResponseWith(
        SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
        { allowedMonitorTypes: ['http'], minimumMonitorFrequency: '3' },
        ['default']
      )
    );
    soClient.update.mockResolvedValueOnce({} as any);

    await repository.save({ allowedMonitorTypes: ['http', 'tcp'] });

    expect(soClient.update).toHaveBeenCalledWith(
      SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
      SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
      {
        allowedMonitorTypes: ['http', 'tcp'],
        minimumMonitorFrequency: '3',
      }
    );
    expect(soClient.updateObjectsSpaces).not.toHaveBeenCalled();
  });

  it('reconciles the policy document spaces without touching the CCS id', async () => {
    soClient.find.mockResolvedValueOnce(
      buildFindResponseWith(
        SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
        { allowedMonitorTypes: ['http'], minimumMonitorFrequency: '' },
        ['default', 'marketing']
      )
    );
    soClient.update.mockResolvedValueOnce({} as any);
    soClient.updateObjectsSpaces.mockResolvedValueOnce({} as any);

    const result = await repository.save({ allowedMonitorTypes: ['http'] }, ['marketing', 'sales']);

    expect(soClient.updateObjectsSpaces).toHaveBeenCalledWith(
      [
        {
          id: SYNTHETICS_SETTINGS_MULTI_SPACE_POLICY_ID,
          type: SYNTHETICS_SETTINGS_MULTI_SPACE_SO_TYPE,
        },
      ],
      ['sales'],
      ['default']
    );
    expect(result.spaces).toEqual(['marketing', 'sales']);
  });
});
