/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ChangeEvent, Ref } from 'react';
import React, { useEffect, useMemo } from 'react';
import type { EuiSelectProps } from '@elastic/eui';
import { EuiSelect } from '@elastic/eui';
import {
  filterFrequencyOptions,
  isFrequencyValueBelowMinimum,
} from '../../../../../../common/lib/schedule_to_time';
import { useMonitorCreationPolicy } from '../../../../../hooks/use_monitor_creation_policy';
import { useIsEditFlow } from '../hooks';

export const FrequencySelect = React.forwardRef<HTMLSelectElement, EuiSelectProps>(
  (props, ref: Ref<HTMLSelectElement>) => {
    const { options = [], value, onChange, ...rest } = props;
    const { minimumMonitorFrequency, loading } = useMonitorCreationPolicy();
    const isEdit = useIsEditFlow();
    const current = String(value ?? '');

    const filtered = useMemo(
      () =>
        filterFrequencyOptions(
          options as Array<{ value: string; text: string }>,
          minimumMonitorFrequency,
          current
        ),
      [options, minimumMonitorFrequency, current]
    );

    useEffect(() => {
      if (loading || isEdit || !minimumMonitorFrequency || !onChange) {
        return;
      }
      if (isFrequencyValueBelowMinimum(current, minimumMonitorFrequency)) {
        onChange({
          target: { value: minimumMonitorFrequency },
        } as ChangeEvent<HTMLSelectElement>);
      }
    }, [loading, isEdit, minimumMonitorFrequency, current, onChange]);

    return (
      <EuiSelect
        {...rest}
        data-test-subj="syntheticsMonitorConfigSchedule"
        value={value}
        options={filtered}
        onChange={onChange}
        inputRef={ref}
      />
    );
  }
);
