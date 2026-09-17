/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SyntheticsMonitorSchedule } from '../runtime_types';
import { ScheduleUnit } from '../runtime_types';

export function scheduleToMilli(schedule: SyntheticsMonitorSchedule): number {
  const timeValue = parseInt(schedule.number, 10);
  return timeValue * getMilliFactorForScheduleUnit(schedule.unit);
}

export function scheduleToMinutes(schedule: SyntheticsMonitorSchedule): number {
  return Math.floor(scheduleToMilli(schedule) / (60 * 1000));
}

// Policy / dropdown values: `'10s'` / `'30s'` for seconds, `'1'`…`'240'` for minutes.
export function frequencyPolicyToMilli(policy?: string): number | undefined {
  if (!policy) {
    return undefined;
  }
  if (policy.endsWith('s')) {
    const seconds = parseInt(policy.slice(0, -1), 10);
    return Number.isFinite(seconds) ? seconds * 1000 : undefined;
  }
  const minutes = parseInt(policy, 10);
  return Number.isFinite(minutes) ? minutes * 60 * 1000 : undefined;
}

export function isScheduleBelowMinimum(
  schedule: SyntheticsMonitorSchedule,
  minimumMonitorFrequency?: string
): boolean {
  const minMs = frequencyPolicyToMilli(minimumMonitorFrequency);
  if (minMs === undefined) {
    return false;
  }
  return scheduleToMilli(schedule) < minMs;
}

export function isFrequencyValueBelowMinimum(
  value: string,
  minimumMonitorFrequency?: string
): boolean {
  const minMs = frequencyPolicyToMilli(minimumMonitorFrequency);
  const valueMs = frequencyPolicyToMilli(value);
  if (minMs === undefined || valueMs === undefined) {
    return false;
  }
  return valueMs < minMs;
}

export function filterFrequencyOptions<T extends { value: string }>(
  options: T[],
  minimumMonitorFrequency?: string,
  currentValue?: string
): T[] {
  return options.filter((option) => {
    if (currentValue && option.value === currentValue) {
      return true;
    }
    return !isFrequencyValueBelowMinimum(option.value, minimumMonitorFrequency);
  });
}

function getMilliFactorForScheduleUnit(scheduleUnit: ScheduleUnit): number {
  switch (scheduleUnit) {
    case ScheduleUnit.SECONDS:
      return 1000;
    case ScheduleUnit.MINUTES:
      return 60 * 1000;
    default:
      throw new Error(`Unit ${scheduleUnit} is not supported`);
  }
}
