/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import { MANAGEMENT_TAB_ID, OVERVIEW_TAB_ID, SloTabId } from './use_selected_tab';
import { useKibana } from '../../../utils/kibana_react';

export const useSloOverviewTabs = ({ selectedTabId }: { selectedTabId: SloTabId }) => {
  const { basePath } = useKibana().services.http;

  const tabs = [
    {
      id: OVERVIEW_TAB_ID,
      label: i18n.translate('xpack.slo.tabs.overviewLabel', {
        defaultMessage: 'Overview',
      }),
      'data-test-subj': 'overviewTab',
      isSelected: selectedTabId === OVERVIEW_TAB_ID,
      href: basePath.prepend('/app/slos'),
    },
    {
      id: MANAGEMENT_TAB_ID,
      label: i18n.translate('xpack.slo.tabs.management', {
        defaultMessage: 'Management',
      }),
      'data-test-subj': 'managementTab',
      isSelected: selectedTabId === MANAGEMENT_TAB_ID,
      href: basePath.prepend('/app/slos/management'),
    },
  ];

  return { tabs };
};
