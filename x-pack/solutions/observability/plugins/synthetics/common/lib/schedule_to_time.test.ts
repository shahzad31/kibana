/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { SyntheticsMonitorSchedule } from '../runtime_types';
import { ScheduleUnit } from '../runtime_types';
import {
  filterFrequencyOptions,
  frequencyPolicyToMilli,
  isFrequencyValueBelowMinimum,
  isScheduleBelowMinimum,
  scheduleToMilli,
} from './schedule_to_time';

describe('schedule_to_time', () => {
  describe('scheduleToMilli', () => {
    it('converts seconds schedule to millis', () => {
      const schedule: SyntheticsMonitorSchedule = { unit: ScheduleUnit.SECONDS, number: '10' };
      expect(scheduleToMilli(schedule)).toEqual(10 * 1000);
    });

    it('converts minutes schedule to millis', () => {
      const schedule: SyntheticsMonitorSchedule = { unit: ScheduleUnit.MINUTES, number: '6' };
      expect(scheduleToMilli(schedule)).toEqual(6 * 60 * 1000);
    });
  });

  describe('frequencyPolicyToMilli', () => {
    it('converts second and minute policy values', () => {
      expect(frequencyPolicyToMilli('10s')).toEqual(10 * 1000);
      expect(frequencyPolicyToMilli('30s')).toEqual(30 * 1000);
      expect(frequencyPolicyToMilli('3')).toEqual(3 * 60 * 1000);
    });

    it('treats empty as no restriction', () => {
      expect(frequencyPolicyToMilli(undefined)).toBeUndefined();
      expect(frequencyPolicyToMilli('')).toBeUndefined();
    });
  });

  describe('isScheduleBelowMinimum', () => {
    it('rejects schedules faster than the floor', () => {
      expect(isScheduleBelowMinimum({ number: '1', unit: ScheduleUnit.MINUTES }, '3')).toBe(true);
      expect(isScheduleBelowMinimum({ number: '10', unit: ScheduleUnit.SECONDS }, '1')).toBe(true);
    });

    it('allows schedules at or slower than the floor', () => {
      expect(isScheduleBelowMinimum({ number: '3', unit: ScheduleUnit.MINUTES }, '3')).toBe(false);
      expect(isScheduleBelowMinimum({ number: '5', unit: ScheduleUnit.MINUTES }, '3')).toBe(false);
    });
  });

  describe('filterFrequencyOptions', () => {
    const options = [{ value: '10s' }, { value: '1' }, { value: '3' }, { value: '5' }];

    it('hides values below the minimum', () => {
      expect(filterFrequencyOptions(options, '3').map((option) => option.value)).toEqual([
        '3',
        '5',
      ]);
    });

    it('keeps the current value even when it is below the minimum', () => {
      expect(filterFrequencyOptions(options, '3', '1').map((option) => option.value)).toEqual([
        '1',
        '3',
        '5',
      ]);
    });
  });

  describe('isFrequencyValueBelowMinimum', () => {
    it('compares dropdown values against the policy', () => {
      expect(isFrequencyValueBelowMinimum('1', '3')).toBe(true);
      expect(isFrequencyValueBelowMinimum('10s', '3')).toBe(true);
      expect(isFrequencyValueBelowMinimum('3', '3')).toBe(false);
    });
  });
});
