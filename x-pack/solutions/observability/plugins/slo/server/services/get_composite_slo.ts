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
import type { BurnRateWindow, SummaryClient } from './summary_client';

const NO_DATA = -1;

interface MemberSummaryData {
  member: { sloId: string; weight: number; instanceId?: string };
  sloName: string;
  summary: {
    sliValue: number;
    fiveMinuteBurnRate: number;
    oneHourBurnRate: number;
    oneDayBurnRate: number;
  };
  burnRateWindows: BurnRateWindow[];
}

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

    const activeMembers = compositeSlo.members.filter((member) =>
      memberDefinitionMap.has(member.sloId)
    );

    const summaryParams = activeMembers.map((member) => ({
      slo: memberDefinitionMap.get(member.sloId)!,
      instanceId: member.instanceId ?? ALL_VALUE,
    }));

    const summaryResults = await this.summaryClient.computeSummaries(summaryParams);

    const memberSummaries: MemberSummaryData[] = activeMembers.map((member, i) => ({
      member,
      sloName: memberDefinitionMap.get(member.sloId)!.name,
      summary: summaryResults[i].summary,
      burnRateWindows: summaryResults[i].burnRateWindows,
    }));

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
    memberSummaries: MemberSummaryData[]
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
    let compositeFiveMinSli = 0;
    let compositeOneHourSli = 0;
    let compositeOneDaySli = 0;

    const components: CompositeSLOComponent[] = memberSummaries.map((ms) => {
      const isActive = ms.summary.sliValue !== NO_DATA;
      const normalisedWeight = isActive ? toHighPrecision(ms.member.weight / totalWeight) : 0;

      if (isActive) {
        compositeSliValue += normalisedWeight * ms.summary.sliValue;
        compositeFiveMinSli += normalisedWeight * getWindowSli(ms.burnRateWindows, '5m');
        compositeOneHourSli += normalisedWeight * getWindowSli(ms.burnRateWindows, '1h');
        compositeOneDaySli += normalisedWeight * getWindowSli(ms.burnRateWindows, '1d');
      }

      return this.buildComponent(ms, normalisedWeight);
    });

    compositeSliValue = toHighPrecision(compositeSliValue);
    compositeFiveMinSli = toHighPrecision(compositeFiveMinSli);
    compositeOneHourSli = toHighPrecision(compositeOneHourSli);
    compositeOneDaySli = toHighPrecision(compositeOneDaySli);

    const { target } = compositeSlo.objective;
    const compositeErrorBudget = 1 - target;
    const consumedErrorBudget =
      compositeSliValue < 0 ? 0 : (1 - compositeSliValue) / compositeErrorBudget;
    const errorBudget = toErrorBudget(compositeErrorBudget, consumedErrorBudget);

    return {
      compositeSummary: {
        sliValue: compositeSliValue,
        errorBudget,
        status: computeSummaryStatus(compositeSlo.objective, compositeSliValue, errorBudget),
        fiveMinuteBurnRate: deriveBurnRate(compositeFiveMinSli, compositeErrorBudget),
        oneHourBurnRate: deriveBurnRate(compositeOneHourSli, compositeErrorBudget),
        oneDayBurnRate: deriveBurnRate(compositeOneDaySli, compositeErrorBudget),
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

function getWindowSli(windows: BurnRateWindow[], name: string): number {
  return windows.find((w) => w.name === name)?.sli ?? NO_DATA;
}

function deriveBurnRate(compositeSli: number, compositeErrorBudget: number): number {
  if (compositeSli >= 1 || compositeErrorBudget <= 0) {
    return 0;
  }
  return toHighPrecision((1 - compositeSli) / compositeErrorBudget);
}
