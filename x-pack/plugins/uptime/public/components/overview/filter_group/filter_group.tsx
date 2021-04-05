/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiFilterGroup } from '@elastic/eui';
import styled from 'styled-components';
import { useRouteMatch } from 'react-router-dom';
import { OverviewFilters } from '../../../../common/runtime_types/overview_filters';
import { filterLabels } from './translations';
import { useFilterUpdate } from '../../../hooks/use_filter_update';
import { MONITOR_ROUTE } from '../../../../common/constants';
import { useSelectedFilters } from '../../../hooks/use_selected_filters';
import {
  FieldValueSuggestions,
  FieldValueSuggestionsProps,
} from '../../../../../observability/public';
import { useIndexPattern } from '../kuery_bar/use_index_pattern';

interface Props {
  loading: boolean;
  overviewFilters: OverviewFilters;
}

const Container = styled(EuiFilterGroup)`
  margin-bottom: 10px;
`;

export const FilterGroupComponent: React.FC<Props> = ({ overviewFilters, loading }) => {
  const { index_pattern: indexPattern } = useIndexPattern();

  const [updatedFieldValues, setUpdatedFieldValues] = useState<{
    fieldName: string;
    values: string[];
  }>({ fieldName: '', values: [] });

  useFilterUpdate(updatedFieldValues.fieldName, updatedFieldValues.values);

  const { selectedLocations, selectedPorts, selectedSchemes, selectedTags } = useSelectedFilters();

  const onFilterFieldChange = (values: string[], fieldName: string) => {
    setUpdatedFieldValues({ fieldName, values });
  };

  const isMonitorPage = useRouteMatch(MONITOR_ROUTE);

  if (indexPattern === null) {
    return <div />;
  }

  const filterPopoverProps: FieldValueSuggestionsProps[] = [
    {
      onChange: onFilterFieldChange,
      sourceField: 'observer.geo.name',
      selectedValues: selectedLocations,
      label: filterLabels.LOCATION,
      indexPattern,
      filters: [],
    },
    // on monitor page we only display location filter in ping list
    ...(!isMonitorPage
      ? [
          {
            onChange: onFilterFieldChange,
            sourceField: 'url.port',
            selectedValues: selectedPorts,
            label: filterLabels.PORT,
            indexPattern,
            filters: [],
          },
          {
            onChange: onFilterFieldChange,
            sourceField: 'monitor.type',
            selectedValues: selectedSchemes,
            label: filterLabels.SCHEME,
            indexPattern,
            filters: [],
          },
          {
            onChange: onFilterFieldChange,
            sourceField: 'tags',
            selectedValues: selectedTags,
            label: filterLabels.TAG,
            indexPattern,
            filters: [],
          },
        ]
      : []),
  ];

  return (
    <Container>
      {filterPopoverProps.map((item) => (
        <FieldValueSuggestions key={item.sourceField} {...item} />
      ))}
    </Container>
  );
};
