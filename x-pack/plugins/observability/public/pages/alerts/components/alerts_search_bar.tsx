/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import React from 'react';
import styled from 'styled-components';
import { useAlertDataView } from '@kbn/alerts-ui-shared';
import { AlertSearchBarWithUrlSyncProps } from '../../../components/alert_search_bar/types';
import { useAlertSearchBarStateContainer } from '../../../components/alert_search_bar/containers';
import { observabilityAlertFeatureIds } from '../../../../common/constants';
import { QuickFilters } from './quick_filters';
import { useKibana } from '../../../utils/kibana_react';
import { ObservabilityPublicPluginsStart } from '../../..';

export function AlertsSearchBarUI(props: AlertSearchBarWithUrlSyncProps) {
  const {
    unifiedSearch: {
      ui: { SearchBar },
    },
    http,
    dataViews: dataViewsService,
    notifications,
  } = useKibana<ObservabilityPublicPluginsStart>().services;

  const { urlStorageKey, ...searchBarProps } = props;
  const stateProps = useAlertSearchBarStateContainer(urlStorageKey);
  const {
    data: {
      query: {
        timefilter: { timefilter: timeFilterService },
      },
    },
    triggersActionsUi: { getAlertsSearchBar: AlertsSearchBar },
    uiSettings,
  } = useKibana().services;

  const { dataViews } = useAlertDataView({
    featureIds: observabilityAlertFeatureIds,
    http,
    dataViewsService,
    toasts: notifications.toasts,
  });

  //
  // const onSearchBarParamsChange = useCallback<
  //   (query: {
  //     dateRange: { from: string; to: string; mode?: 'absolute' | 'relative' };
  //     query?: string;
  //   }) => void
  // >(
  //   ({ dateRange, query }) => {
  //     try {
  //       // First try to create es query to make sure query is valid, then save it in state
  //       const esQuery = buildEsQuery({
  //         timeRange: {
  //           to: dateRange.to,
  //           from: dateRange.from,
  //         },
  //         kuery: query,
  //         queries: [...getAlertStatusQuery(status), ...defaultSearchQueries],
  //         config: getEsQueryConfig(uiSettings),
  //       });
  //       if (query) onKueryChange(query);
  //       timeFilterService.setTime(dateRange);
  //       onRangeFromChange(dateRange.from);
  //       onRangeToChange(dateRange.to);
  //       onEsQueryChange(esQuery);
  //     } catch (error) {
  //       toasts.addError(error, {
  //         title: toastTitle,
  //       });
  //       onKueryChange(DEFAULT_QUERY_STRING);
  //     }
  //   },
  //   [
  //     status,
  //     defaultSearchQueries,
  //     uiSettings,
  //     onKueryChange,
  //     timeFilterService,
  //     onRangeFromChange,
  //     onRangeToChange,
  //     onEsQueryChange,
  //     toasts,
  //   ]
  // );

  return (
    <Container>
      <SearchBar
        appName="observability"
        placeholder={i18n.translate('xpack.observability.slo.list.search', {
          defaultMessage: 'Search your SLOs...',
        })}
        indexPatterns={dataViews ? dataViews : []}
        isDisabled={false}
        filters={[]}
        renderQueryInputAppend={() => <QuickFilters dataViews={dataViews} />}
        onFiltersUpdated={(newFilters) => {}}
        onQuerySubmit={({ query: value }) => {}}
        query={{ query: String(''), language: 'kuery' }}
        showSubmitButton={true}
        showQueryInput={true}
        disableQueryLanguageSwitcher={true}
        saveQueryMenuVisibility="globally_managed"
      />
    </Container>
  );
}

const Container = styled.div`
  .uniSearchBar {
    padding: 0;
  }
`;
