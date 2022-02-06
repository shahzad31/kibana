/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiFlyout, EuiFlyoutBody, EuiFlyoutHeader, EuiTitle } from '@elastic/eui';
import React from 'react';
import { useLocations } from '../../components/monitor_management/hooks/use_locations';
import { Loader } from '../../components/monitor_management/loader/loader';
import {
  defaultConfig,
  SyntheticsProviders,
  usePolicyConfigContext,
} from '../../components/fleet_package/contexts';
import { ConfigKey, ScheduleUnit } from '../../../common/runtime_types';
import {
  LOADING_LABEL,
  ERROR_BODY_LABEL,
  ERROR_HEADING_LABEL,
} from '../../pages/monitor_management/add_monitor';
import { MonitorFields } from '../../components/monitor_management/monitor_config/monitor_fields';
import { usePolicy } from '../../components/fleet_package/hooks/use_policy';
import { useFormatMonitor } from '../../components/monitor_management/hooks/use_format_monitor';
import { validate } from '../../components/monitor_management/validation';
import { useServiceUrl } from './use_service_url';

export const AddMonitorFlyout = ({
  onClose,
  initialValues,
}: {
  onClose: () => void;
  initialValues?: {
    serviceName: string;
  };
}) => {
  const { error, loading, locations } = useLocations();

  const { monitorType } = usePolicyConfigContext();

  const policyConfig = usePolicy();

  const { isValid, config } = useFormatMonitor({
    monitorType,
    validate,
    config: policyConfig[monitorType],
    defaultConfig: defaultConfig[monitorType],
  });

  const { url, loading: urlLoading } = useServiceUrl();

  return (
    <EuiFlyout onClose={onClose}>
      <EuiFlyoutHeader>
        <EuiTitle>
          <h2>Add monitor </h2>
        </EuiTitle>
      </EuiFlyoutHeader>
      <EuiFlyoutBody>
        <Loader
          error={Boolean(error) || (locations && locations.length === 0)}
          loading={loading || urlLoading}
          loadingTitle={LOADING_LABEL}
          errorTitle={ERROR_HEADING_LABEL}
          errorBody={ERROR_BODY_LABEL}
        >
          <SyntheticsProviders
            policyDefaultValues={{
              isZipUrlSourceEnabled: false,
              allowedScheduleUnits: [ScheduleUnit.MINUTES],
            }}
            httpDefaultValues={{
              [ConfigKey.APM_SERVICE_NAME]: initialValues?.serviceName ?? '',
              [ConfigKey.SCHEDULE]: { number: '3', unit: ScheduleUnit.MINUTES },
              [ConfigKey.REQUEST_HEADERS_CHECK]: {},
              [ConfigKey.RESPONSE_HEADERS_CHECK]: {},
              [ConfigKey.REQUEST_BODY_CHECK]: { value: '', type: 'text' },
              [ConfigKey.RESPONSE_BODY_CHECK_POSITIVE]: [],
              [ConfigKey.RESPONSE_BODY_CHECK_NEGATIVE]: [],
              [ConfigKey.RESPONSE_STATUS_CHECK]: [],
              [ConfigKey.TAGS]: [],
              [ConfigKey.TIMEOUT]: '16',
              [ConfigKey.URLS]: url ?? '',
            }}
          >
            <MonitorFields />
          </SyntheticsProviders>
        </Loader>
      </EuiFlyoutBody>
    </EuiFlyout>
  );
};
