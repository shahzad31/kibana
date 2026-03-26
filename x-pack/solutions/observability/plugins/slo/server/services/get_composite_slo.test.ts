/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createSLO, createAPMTransactionErrorRateIndicator } from './fixtures/slo';
import { createCompositeSlo } from './fixtures/composite_slo';
import { GetCompositeSLO } from './get_composite_slo';
import {
  createSummaryClientMock,
  createSLORepositoryMock,
  createCompositeSLORepositoryMock,
} from './mocks';
import type { CompositeSLORepository } from './composite_slo_repository';
import type { SLODefinitionRepository } from './slo_definition_repository';
import type { SummaryClient } from './summary_client';
import type { Summary } from '../domain/models';

const buildSummary = (overrides: Partial<Summary> = {}): Summary => ({
  status: 'HEALTHY',
  sliValue: 0.995,
  errorBudget: { initial: 0.01, consumed: 0.5, remaining: 0.5, isEstimated: false },
  fiveMinuteBurnRate: 1.2,
  oneHourBurnRate: 0.9,
  oneDayBurnRate: 0.8,
  ...overrides,
});

describe('GetCompositeSLO', () => {
  let mockCompositeRepo: jest.Mocked<CompositeSLORepository>;
  let mockSloRepo: jest.Mocked<SLODefinitionRepository>;
  let mockSummaryClient: jest.Mocked<SummaryClient>;
  let getCompositeSLO: GetCompositeSLO;

  beforeEach(() => {
    mockCompositeRepo = createCompositeSLORepositoryMock();
    mockSloRepo = createSLORepositoryMock();
    mockSummaryClient = createSummaryClientMock();
    getCompositeSLO = new GetCompositeSLO(mockCompositeRepo, mockSloRepo, mockSummaryClient);
  });

  it('computes weighted SLI from component SLOs', async () => {
    const sloA = createSLO({
      id: 'slo-a-xxxxxxxx',
      name: 'Service A',
      indicator: createAPMTransactionErrorRateIndicator(),
    });
    const sloB = createSLO({
      id: 'slo-b-xxxxxxxx',
      name: 'Service B',
      indicator: createAPMTransactionErrorRateIndicator(),
    });

    const composite = createCompositeSlo({
      members: [
        { sloId: sloA.id, weight: 6 },
        { sloId: sloB.id, weight: 4 },
      ],
      objective: { target: 0.99 },
    });

    mockCompositeRepo.findById.mockResolvedValue(composite);
    mockSloRepo.findAllByIds.mockResolvedValue([sloA, sloB]);

    mockSummaryClient.computeSummary
      .mockResolvedValueOnce({
        groupings: {},
        meta: {},
        summary: buildSummary({
          sliValue: 0.995,
          fiveMinuteBurnRate: 1.0,
          oneHourBurnRate: 0.8,
          oneDayBurnRate: 0.5,
        }),
      })
      .mockResolvedValueOnce({
        groupings: {},
        meta: {},
        summary: buildSummary({
          sliValue: 0.98,
          fiveMinuteBurnRate: 2.0,
          oneHourBurnRate: 1.5,
          oneDayBurnRate: 1.0,
        }),
      });

    const result = await getCompositeSLO.execute(composite.id);

    // normalisedWeight: sloA = 6/10 = 0.6, sloB = 4/10 = 0.4
    // compositeSLI = 0.6 * 0.995 + 0.4 * 0.98 = 0.597 + 0.392 = 0.989
    expect(result.summary.sliValue).toBeCloseTo(0.989, 3);
    expect(result.summary.status).toBe('DEGRADING');

    // composite 5m burn rate = 0.6 * 1.0 + 0.4 * 2.0 = 1.4
    expect(result.summary.fiveMinuteBurnRate).toBeCloseTo(1.4, 3);
    // composite 1h burn rate = 0.6 * 0.8 + 0.4 * 1.5 = 1.08
    expect(result.summary.oneHourBurnRate).toBeCloseTo(1.08, 3);
    // composite 1d burn rate = 0.6 * 0.5 + 0.4 * 1.0 = 0.7
    expect(result.summary.oneDayBurnRate).toBeCloseTo(0.7, 3);

    expect(result.components).toHaveLength(2);
    expect(result.components[0]).toMatchObject({
      id: sloA.id,
      name: 'Service A',
      weight: 6,
      normalisedWeight: 0.6,
    });
    expect(result.components[1]).toMatchObject({
      id: sloB.id,
      name: 'Service B',
      weight: 4,
      normalisedWeight: 0.4,
    });
  });

  it('computes error budget from composite SLI and target', async () => {
    const sloA = createSLO({
      id: 'slo-a-xxxxxxxx',
      name: 'A',
      indicator: createAPMTransactionErrorRateIndicator(),
    });

    const composite = createCompositeSlo({
      members: [{ sloId: sloA.id, weight: 1 }],
      objective: { target: 0.99 },
    });

    mockCompositeRepo.findById.mockResolvedValue(composite);
    mockSloRepo.findAllByIds.mockResolvedValue([sloA]);
    mockSummaryClient.computeSummary.mockResolvedValueOnce({
      groupings: {},
      meta: {},
      summary: buildSummary({ sliValue: 0.995 }),
    });

    const result = await getCompositeSLO.execute(composite.id);

    // initialErrorBudget = 1 - 0.99 = 0.01
    // consumed = (1 - 0.995) / 0.01 = 0.5
    // remaining = 1 - 0.5 = 0.5
    expect(result.summary.errorBudget.initial).toBeCloseTo(0.01, 4);
    expect(result.summary.errorBudget.consumed).toBeCloseTo(0.5, 4);
    expect(result.summary.errorBudget.remaining).toBeCloseTo(0.5, 4);
  });

  it('excludes members with no data and re-normalises weights', async () => {
    const sloA = createSLO({
      id: 'slo-a-xxxxxxxx',
      name: 'With Data',
      indicator: createAPMTransactionErrorRateIndicator(),
    });
    const sloB = createSLO({
      id: 'slo-b-xxxxxxxx',
      name: 'No Data',
      indicator: createAPMTransactionErrorRateIndicator(),
    });

    const composite = createCompositeSlo({
      members: [
        { sloId: sloA.id, weight: 3 },
        { sloId: sloB.id, weight: 7 },
      ],
      objective: { target: 0.99 },
    });

    mockCompositeRepo.findById.mockResolvedValue(composite);
    mockSloRepo.findAllByIds.mockResolvedValue([sloA, sloB]);

    mockSummaryClient.computeSummary
      .mockResolvedValueOnce({
        groupings: {},
        meta: {},
        summary: buildSummary({ sliValue: 0.995 }),
      })
      .mockResolvedValueOnce({
        groupings: {},
        meta: {},
        summary: buildSummary({ sliValue: -1 }),
      });

    const result = await getCompositeSLO.execute(composite.id);

    // sloB has no data (-1), so only sloA participates with normalisedWeight = 1.0
    expect(result.summary.sliValue).toBeCloseTo(0.995, 4);
    expect(result.components[0].normalisedWeight).toBe(1);
    expect(result.components[1].normalisedWeight).toBe(0);
    expect(result.components[1].sliValue).toBe(-1);
    expect(result.components[1].contribution).toBe(0);
  });

  it('returns NO_DATA status when all components lack data', async () => {
    const sloA = createSLO({
      id: 'slo-a-xxxxxxxx',
      name: 'No Data A',
      indicator: createAPMTransactionErrorRateIndicator(),
    });
    const sloB = createSLO({
      id: 'slo-b-xxxxxxxx',
      name: 'No Data B',
      indicator: createAPMTransactionErrorRateIndicator(),
    });

    const composite = createCompositeSlo({
      members: [
        { sloId: sloA.id, weight: 1 },
        { sloId: sloB.id, weight: 1 },
      ],
    });

    mockCompositeRepo.findById.mockResolvedValue(composite);
    mockSloRepo.findAllByIds.mockResolvedValue([sloA, sloB]);

    mockSummaryClient.computeSummary
      .mockResolvedValueOnce({
        groupings: {},
        meta: {},
        summary: buildSummary({ sliValue: -1 }),
      })
      .mockResolvedValueOnce({
        groupings: {},
        meta: {},
        summary: buildSummary({ sliValue: -1 }),
      });

    const result = await getCompositeSLO.execute(composite.id);

    expect(result.summary.sliValue).toBe(-1);
    expect(result.summary.status).toBe('NO_DATA');
  });

  it('skips deleted members that no longer exist in the repository', async () => {
    const sloA = createSLO({
      id: 'slo-a-xxxxxxxx',
      name: 'Existing',
      indicator: createAPMTransactionErrorRateIndicator(),
    });

    const composite = createCompositeSlo({
      members: [
        { sloId: sloA.id, weight: 1 },
        { sloId: 'deleted-xxxxxxxx', weight: 2 },
      ],
      objective: { target: 0.99 },
    });

    mockCompositeRepo.findById.mockResolvedValue(composite);
    // findAllByIds only returns sloA; deleted SLO is not returned
    mockSloRepo.findAllByIds.mockResolvedValue([sloA]);

    mockSummaryClient.computeSummary.mockResolvedValueOnce({
      groupings: {},
      meta: {},
      summary: buildSummary({ sliValue: 0.995 }),
    });

    const result = await getCompositeSLO.execute(composite.id);

    // Only sloA participates
    expect(result.summary.sliValue).toBeCloseTo(0.995, 4);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].id).toBe(sloA.id);
    expect(result.components[0].normalisedWeight).toBe(1);
  });

  it('passes instanceId to summary client when member specifies it', async () => {
    const sloA = createSLO({
      id: 'slo-a-xxxxxxxx',
      name: 'A',
      indicator: createAPMTransactionErrorRateIndicator(),
    });

    const composite = createCompositeSlo({
      members: [{ sloId: sloA.id, weight: 1, instanceId: 'my-instance' }],
    });

    mockCompositeRepo.findById.mockResolvedValue(composite);
    mockSloRepo.findAllByIds.mockResolvedValue([sloA]);
    mockSummaryClient.computeSummary.mockResolvedValueOnce({
      groupings: {},
      meta: {},
      summary: buildSummary({ sliValue: 0.999 }),
    });

    const result = await getCompositeSLO.execute(composite.id);

    expect(mockSummaryClient.computeSummary).toHaveBeenCalledWith({
      slo: sloA,
      instanceId: 'my-instance',
    });
    expect(result.components[0].instanceId).toBe('my-instance');
  });

  it('returns VIOLATED status when composite SLI is below target and error budget exhausted', async () => {
    const sloA = createSLO({
      id: 'slo-a-xxxxxxxx',
      name: 'Violated',
      indicator: createAPMTransactionErrorRateIndicator(),
    });

    const composite = createCompositeSlo({
      members: [{ sloId: sloA.id, weight: 1 }],
      objective: { target: 0.999 },
    });

    mockCompositeRepo.findById.mockResolvedValue(composite);
    mockSloRepo.findAllByIds.mockResolvedValue([sloA]);
    mockSummaryClient.computeSummary.mockResolvedValueOnce({
      groupings: {},
      meta: {},
      summary: buildSummary({ sliValue: 0.95 }),
    });

    const result = await getCompositeSLO.execute(composite.id);

    // initialErrorBudget = 0.001, consumed = (1 - 0.95) / 0.001 = 50
    // remaining = 1 - 50 = -49 < 0
    expect(result.summary.status).toBe('VIOLATED');
    expect(result.summary.errorBudget.remaining).toBeLessThan(0);
  });
});
