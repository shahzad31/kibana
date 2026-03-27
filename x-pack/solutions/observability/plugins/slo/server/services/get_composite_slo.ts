/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type {
  CompositeSLOComponent,
  CompositeSLOSummary,
  GetCompositeSLOResponse,
} from '@kbn/slo-schema';
import { ALL_VALUE, getCompositeSLOResponseSchema } from '@kbn/slo-schema';
import { toHighPrecision } from '../utils/number';
import type { CompositeSLODefinition } from '../domain/models';
import { computeSummaryStatus, toErrorBudget } from '../domain/services';
import type { CompositeSLORepository } from './composite_slo_repository';
import type { SLODefinitionRepository } from './slo_definition_repository';
import type { SummaryClient } from './summary_client';

const NO_DATA = -1;

export class GetCompositeSLO {
  constructor(
    private compositeSloRepository: CompositeSLORepository,
    private sloDefinitionRepository: SLODefinitionRepository,
    private summaryClient: SummaryClient
  ) {}

  public async execute(id: string): Promise<GetCompositeSLOResponse> {
    const compositeSlo = await this.compositeSloRepository.findById(id);
    const memberSloIds = compositeSlo.members.map((m) => m.sloId);
    const memberDefinitions = await this.sloDefinitionRepository.findAllByIds(memberSloIds);

    const memberDefinitionMap = new Map(memberDefinitions.map((slo) => [slo.id, slo]));

    const memberSummaries = await Promise.all(
      compositeSlo.members
        .filter((member) => memberDefinitionMap.has(member.sloId))
        .map(async (member) => {
          const slo = memberDefinitionMap.get(member.sloId)!;
          const instanceId = member.instanceId ?? ALL_VALUE;
          const { summary } = await this.summaryClient.computeSummary({ slo, instanceId });

          return {
            member,
            sloName: slo.name,
            summary,
          };
        })
    );

    const { compositeSummary, components } = this.computeWeightedAggregate(
      compositeSlo,
      memberSummaries
    );

    return getCompositeSLOResponseSchema.encode({
      ...compositeSlo,
      summary: compositeSummary,
      components,
    });
  }

  private computeWeightedAggregate(
    compositeSlo: CompositeSLODefinition,
    memberSummaries: Array<{
      member: { sloId: string; weight: number; instanceId?: string };
      sloName: string;
      summary: { sliValue: number; fiveMinuteBurnRate: number; oneHourBurnRate: number; oneDayBurnRate: number };
    }>
  ): { compositeSummary: CompositeSLOSummary; components: CompositeSLOComponent[] } {
    const activeMembers = memberSummaries.filter((ms) => ms.summary.sliValue !== NO_DATA);

    if (activeMembers.length === 0) {
      return {
        compositeSummary: this.buildNoDataSummary(),
        components: memberSummaries.map((ms) => this.buildComponent(ms, 0)),
      };
    }

    const totalWeight = activeMembers.reduce((sum, ms) => sum + ms.member.weight, 0);

    let compositeSliValue = 0;
    let compositeFiveMinBurnRate = 0;
    let compositeOneHourBurnRate = 0;
    let compositeOneDayBurnRate = 0;

    const components: CompositeSLOComponent[] = memberSummaries.map((ms) => {
      const isActive = ms.summary.sliValue !== NO_DATA;
      const normalisedWeight = isActive ? toHighPrecision(ms.member.weight / totalWeight) : 0;

      if (isActive) {
        compositeSliValue += normalisedWeight * ms.summary.sliValue;
        compositeFiveMinBurnRate += normalisedWeight * ms.summary.fiveMinuteBurnRate;
        compositeOneHourBurnRate += normalisedWeight * ms.summary.oneHourBurnRate;
        compositeOneDayBurnRate += normalisedWeight * ms.summary.oneDayBurnRate;
      }

      return this.buildComponent(ms, normalisedWeight);
    });

    compositeSliValue = toHighPrecision(compositeSliValue);
    compositeFiveMinBurnRate = toHighPrecision(compositeFiveMinBurnRate);
    compositeOneHourBurnRate = toHighPrecision(compositeOneHourBurnRate);
    compositeOneDayBurnRate = toHighPrecision(compositeOneDayBurnRate);

    const { target } = compositeSlo.objective;
    const initialErrorBudget = 1 - target;
    const consumedErrorBudget =
      compositeSliValue < 0 ? 0 : (1 - compositeSliValue) / initialErrorBudget;
    const errorBudget = toErrorBudget(initialErrorBudget, consumedErrorBudget);

    return {
      compositeSummary: {
        sliValue: compositeSliValue,
        errorBudget,
        status: computeSummaryStatus(compositeSlo.objective, compositeSliValue, errorBudget),
        fiveMinuteBurnRate: compositeFiveMinBurnRate,
        oneHourBurnRate: compositeOneHourBurnRate,
        oneDayBurnRate: compositeOneDayBurnRate,
      },
      components,
    };
  }

  private buildComponent(
    ms: {
      member: { sloId: string; weight: number; instanceId?: string };
      sloName: string;
      summary: { sliValue: number };
    },
    normalisedWeight: number
  ): CompositeSLOComponent {
    const sliValue = ms.summary.sliValue;
    const contribution = sliValue === NO_DATA ? 0 : toHighPrecision(normalisedWeight * sliValue);

    return {
      id: ms.member.sloId,
      name: ms.sloName,
      weight: ms.member.weight,
      normalisedWeight,
      sliValue,
      contribution,
      ...(ms.member.instanceId !== undefined ? { instanceId: ms.member.instanceId } : {}),
    };
  }

  private buildNoDataSummary(): CompositeSLOSummary {
    return {
      sliValue: NO_DATA,
      errorBudget: toErrorBudget(0, 0),
      status: 'NO_DATA',
      fiveMinuteBurnRate: 0,
      oneHourBurnRate: 0,
      oneDayBurnRate: 0,
    };
  }
}
