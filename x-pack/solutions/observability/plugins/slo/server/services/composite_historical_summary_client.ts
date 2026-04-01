/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core/server';
import type {
  FetchCompositeHistoricalSummaryParams,
  FetchCompositeHistoricalSummaryResponse,
  FetchHistoricalSummaryParams,
  FetchHistoricalSummaryResponse,
  HistoricalSummaryResponse,
} from '@kbn/slo-schema';
import { ALL_VALUE } from '@kbn/slo-schema';
import { toHighPrecision } from '../utils/number';
import { computeSummaryStatus, toErrorBudget } from '../domain/services';
import type { CompositeSLODefinition, SLODefinition } from '../domain/models';
import type { CompositeSLORepository } from './composite_slo_repository';
import type { SLODefinitionRepository } from './slo_definition_repository';
import { HistoricalSummaryClient } from './historical_summary_client';

const NO_DATA = -1;

export interface HistoricalSummaryProvider {
  fetch(params: FetchHistoricalSummaryParams): Promise<FetchHistoricalSummaryResponse>;
}

export class CompositeHistoricalSummaryClient {
  private historicalSummaryProvider: HistoricalSummaryProvider;

  constructor(
    esClient: ElasticsearchClient,
    private compositeSloRepository: CompositeSLORepository,
    private sloDefinitionRepository: SLODefinitionRepository,
    historicalSummaryProvider?: HistoricalSummaryProvider
  ) {
    this.historicalSummaryProvider =
      historicalSummaryProvider ?? new HistoricalSummaryClient(esClient);
  }

  async fetch(
    params: FetchCompositeHistoricalSummaryParams
  ): Promise<FetchCompositeHistoricalSummaryResponse> {
    const compositeDefinitions = await Promise.all(
      params.list.map((id) => this.compositeSloRepository.findById(id))
    );

    const allMemberSloIds = [
      ...new Set(compositeDefinitions.flatMap((comp) => comp.members.map((m) => m.sloId))),
    ];
    const memberDefinitions = await this.sloDefinitionRepository.findAllByIds(allMemberSloIds);
    const memberDefMap = new Map(memberDefinitions.map((slo) => [slo.id, slo]));

    const results: FetchCompositeHistoricalSummaryResponse = [];

    for (const composite of compositeDefinitions) {
      const memberHistoricalData = await this.fetchMemberHistoricalData(composite, memberDefMap);

      const compositeHistorical = this.computeWeightedHistorical(composite, memberHistoricalData);
      results.push({ compositeId: composite.id, data: compositeHistorical });
    }

    return results;
  }

  private async fetchMemberHistoricalData(
    composite: CompositeSLODefinition,
    memberDefMap: Map<string, SLODefinition>
  ) {
    const activeMembers = composite.members.filter((m) => memberDefMap.has(m.sloId));
    if (activeMembers.length === 0) return [];

    const list = activeMembers.map((member) => {
      const slo = memberDefMap.get(member.sloId)!;
      return {
        sloId: slo.id,
        instanceId: member.instanceId ?? ALL_VALUE,
        timeWindow: composite.timeWindow,
        budgetingMethod: composite.budgetingMethod,
        groupBy: slo.groupBy,
        revision: slo.revision,
        objective: slo.objective,
      };
    });

    const historicalData = await this.historicalSummaryProvider.fetch({ list });

    return activeMembers.map((member, idx) => ({
      member,
      data: historicalData[idx]?.data ?? [],
    }));
  }

  private computeWeightedHistorical(
    composite: CompositeSLODefinition,
    memberHistoricalData: Array<{
      member: { sloId: string; weight: number; instanceId?: string };
      data: HistoricalSummaryResponse[];
    }>
  ): HistoricalSummaryResponse[] {
    if (memberHistoricalData.length === 0) return [];

    const dateSet = new Set<string>();
    for (const { data } of memberHistoricalData) {
      for (const point of data) {
        dateSet.add(point.date);
      }
    }
    const sortedDates = [...dateSet].sort();

    const memberDataByDate = memberHistoricalData.map(({ member, data }) => {
      const byDate = new Map(data.map((d) => [d.date, d]));
      return { member, byDate };
    });

    const { target } = composite.objective;
    const initialErrorBudget = 1 - target;

    return sortedDates.map((date) => {
      let totalWeight = 0;
      let weightedSli = 0;
      let hasData = false;

      for (const { member, byDate } of memberDataByDate) {
        const point = byDate.get(date);
        if (!point || point.status === 'NO_DATA' || point.sliValue === NO_DATA) {
          continue;
        }
        hasData = true;
        totalWeight += member.weight;
        weightedSli += member.weight * point.sliValue;
      }

      if (!hasData || totalWeight === 0) {
        return {
          date,
          sliValue: NO_DATA,
          errorBudget: toErrorBudget(0, 0),
          status: 'NO_DATA' as const,
        };
      }

      const sliValue = toHighPrecision(weightedSli / totalWeight);
      const consumedErrorBudget =
        sliValue < 0 || initialErrorBudget <= 0 ? 0 : (1 - sliValue) / initialErrorBudget;
      const errorBudget = toErrorBudget(initialErrorBudget, consumedErrorBudget);
      const status = computeSummaryStatus(composite.objective, sliValue, errorBudget);

      return { date, sliValue, errorBudget, status };
    });
  }
}
