/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiSpacer } from '@elastic/eui';
import { ErrorsTabContent } from './errors_tab_content';
import { SyntheticsDatePicker } from '../../common/date_picker/synthetics_date_picker';
import { SearchField } from '../common/search_field';
import { FilterGroup } from '../common/monitor_filters/filter_group';
import { useMonitorFiltersState } from '../common/monitor_filters/use_filters';
import { useAllMonitorErrors } from '../hooks/use_all_errors';
import { useErrorsBreadcrumbs } from './use_errors_breadcrumbs';

export const ErrorsTab = () => {
  const { errorStates, upStates, loading, monitorIds } = useAllMonitorErrors();
  const { handleFilterChange } = useMonitorFiltersState();
  useErrorsBreadcrumbs();

  return (
    <div>
      <SyntheticsDatePicker fullWidth={true} />
      <EuiSpacer size="m" />
      <EuiFlexGroup gutterSize="s" wrap={true}>
        <EuiFlexItem>
          <SearchField />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <FilterGroup handleFilterChange={handleFilterChange} />
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      <ErrorsTabContent
        errorStates={errorStates}
        upStates={upStates}
        loading={loading}
        monitorIds={monitorIds}
      />
    </div>
  );
};
