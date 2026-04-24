/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiSpacer } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { MonitorErrorsCount } from './monitor_errors_count';
import { ErrorsList } from '../../monitor_details/monitor_errors/errors_list';
import { ErrorGroupsList } from './error_groups_list';
import type { PingState } from '../../../../../../common/runtime_types';
import type { ErrorGroup } from '../../../../../../common/runtime_types';
import { PanelWithTitle } from '../../common/components/panel_with_title';
import { FailedTestsCount } from './failed_tests_count';
import { MonitorFailedTests } from './failed_tests';
import { useRefreshedRangeFromUrl } from '../../../hooks';

export const ErrorsTabContent = ({
  errorStates,
  loading,
  upStates,
  monitorIds,
  errorGroups,
  errorGroupsLoading,
}: {
  errorStates: PingState[];
  upStates: PingState[];
  loading: boolean;
  monitorIds: string[];
  errorGroups: ErrorGroup[];
  errorGroupsLoading: boolean;
}) => {
  const time = useRefreshedRangeFromUrl();

  return (
    <>
      <EuiFlexGroup gutterSize="m" wrap={true}>
        <EuiFlexItem grow={1}>
          <PanelWithTitle title={OVERVIEW_LABEL} titleLeftAlign css={{ minWidth: 260 }}>
            <EuiFlexGroup wrap={true} responsive={false}>
              <EuiFlexItem>
                <MonitorErrorsCount from={time.from} to={time.to} monitorIds={monitorIds} />
              </EuiFlexItem>
              <EuiFlexItem>
                <FailedTestsCount from={time.from} to={time.to} monitorIds={monitorIds} />
              </EuiFlexItem>
            </EuiFlexGroup>
          </PanelWithTitle>
        </EuiFlexItem>
        <EuiFlexItem grow={3}>
          <PanelWithTitle title={FAILED_TESTS_LABEL}>
            <MonitorFailedTests time={time} monitorIds={monitorIds} />
          </PanelWithTitle>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      <PanelWithTitle title={ERROR_GROUPS_LABEL}>
        <ErrorGroupsList groups={errorGroups} loading={errorGroupsLoading} />
      </PanelWithTitle>
      <EuiSpacer size="m" />
      <PanelWithTitle title={ERRORS_LABEL}>
        <ErrorsList
          errorStates={errorStates}
          upStates={upStates}
          loading={loading}
          showMonitorName={true}
        />
      </PanelWithTitle>
    </>
  );
};

const ERRORS_LABEL = i18n.translate('xpack.synthetics.errors.label', {
  defaultMessage: 'Errors',
});

const ERROR_GROUPS_LABEL = i18n.translate('xpack.synthetics.errors.errorGroups', {
  defaultMessage: 'Error groups',
});

const OVERVIEW_LABEL = i18n.translate('xpack.synthetics.errors.overview', {
  defaultMessage: 'Overview',
});

const FAILED_TESTS_LABEL = i18n.translate('xpack.synthetics.errors.failedTests', {
  defaultMessage: 'Failed tests',
});
