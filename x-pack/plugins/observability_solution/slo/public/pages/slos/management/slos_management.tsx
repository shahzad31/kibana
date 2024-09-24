/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import {
  DefaultItemAction,
  EuiBasicTable,
  EuiBasicTableColumn,
  EuiIcon,
  EuiTableSelectionType,
  EuiText,
  EuiToolTip,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { rulesLocatorID } from '@kbn/observability-plugin/common';
import { RulesParams } from '@kbn/observability-plugin/public';
import { ALL_VALUE, SLODefinitionResponse, SLOWithSummaryResponse } from '@kbn/slo-schema';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useFetchSloDefinitions } from '../../../hooks/use_fetch_slo_definitions';
import { useResetSlo } from '../../../hooks/use_reset_slo';
import { createRemoteSloEditUrl } from '../../../utils/slo/remote_slo_urls';
import {
  createRemoteSloDeleteUrl,
  createRemoteSloResetUrl,
} from '../../../utils/slo/remote_slo_urls';
import { paths } from '../../../../common/locators/paths';
import { SloTagsList } from '../components/common/slo_tags_list';
import { SloListEmpty } from '../components/slo_list_empty';
import { useCloneSlo } from '../../../hooks/use_clone_slo';
import { useGetFilteredRuleTypes } from '../../../hooks/use_get_filtered_rule_types';
import { usePermissions } from '../../../hooks/use_permissions';
import { useSpace } from '../../../hooks/use_space';
import { useKibana } from '../../../utils/kibana_react';

export function SLOsManagementPage() {
  const {
    application: { navigateToUrl },
    http: { basePath },
    uiSettings,
    share: {
      url: { locators },
    },
    triggersActionsUi: { getAddRuleFlyout: AddRuleFlyout },
  } = useKibana().services;
  const spaceId = useSpace();

  const { isLoading, data: sloList, isError } = useFetchSloDefinitions({});

  const percentFormat = uiSettings.get('format:percent:defaultPattern');
  const sloIdsAndInstanceIds = sloList?.results?.map(
    (slo) => [slo.id, slo.instanceId ?? ALL_VALUE] as [string, string]
  );

  const { data: permissions } = usePermissions();
  const filteredRuleTypes = useGetFilteredRuleTypes();
  const queryClient = useQueryClient();

  const { mutateAsync: resetSlo, isLoading: isResetLoading } = useResetSlo();

  const [sloToAddRule, setSloToAddRule] = useState<SLOWithSummaryResponse | undefined>(undefined);
  const [sloToDelete, setSloToDelete] = useState<SLOWithSummaryResponse | undefined>(undefined);
  const [sloToReset, setSloToReset] = useState<SLOWithSummaryResponse | undefined>(undefined);

  const navigateToClone = useCloneSlo();

  const isRemote = (slo: SLOWithSummaryResponse) => !!slo.remote;
  const hasRemoteKibanaUrl = (slo: SLOWithSummaryResponse) =>
    !!slo.remote && slo.remote.kibanaUrl !== '';

  const [selectedItems, setSelectedItems] = useState<SLOWithSummaryResponse[]>([]);
  const onSelectionChange = (selItems: SLOWithSummaryResponse[]) => {
    setSelectedItems(selItems);
  };

  const buildActionName = (actionName: string) => (slo: SLOWithSummaryResponse) =>
    isRemote(slo) ? (
      <>
        {actionName}
        <EuiIcon
          type="popout"
          size="s"
          css={{
            marginLeft: '10px',
          }}
        />
      </>
    ) : (
      actionName
    );

  const actions: Array<DefaultItemAction<SLOWithSummaryResponse>> = [
    {
      type: 'icon',
      icon: 'inspect',
      name: i18n.translate('xpack.slo.item.actions.details', {
        defaultMessage: 'Details',
      }),
      description: i18n.translate('xpack.slo.item.actions.details', {
        defaultMessage: 'Details',
      }),
      onClick: (slo: SLOWithSummaryResponse) => {
        const sloDetailsUrl = basePath.prepend(
          paths.sloDetails(
            slo.id,
            ![slo.groupBy].flat().includes(ALL_VALUE) && slo.instanceId
              ? slo.instanceId
              : undefined,
            slo.remote?.remoteName
          )
        );
        navigateToUrl(sloDetailsUrl);
      },
    },
    {
      type: 'icon',
      icon: 'pencil',
      name: buildActionName(
        i18n.translate('xpack.slo.item.actions.edit', {
          defaultMessage: 'Edit',
        })
      ),
      description: i18n.translate('xpack.slo.item.actions.edit', {
        defaultMessage: 'Edit',
      }),
      'data-test-subj': 'sloActionsEdit',
      enabled: (slo) =>
        (permissions?.hasAllWriteRequested && !isRemote(slo)) || hasRemoteKibanaUrl(slo),
      onClick: (slo: SLOWithSummaryResponse) => {
        const remoteEditUrl = createRemoteSloEditUrl(slo, spaceId);
        if (!!remoteEditUrl) {
          window.open(remoteEditUrl, '_blank');
        } else {
          navigateToUrl(basePath.prepend(paths.sloEdit(slo.id)));
        }
      },
    },
    {
      type: 'icon',
      icon: 'bell',
      name: i18n.translate('xpack.slo.item.actions.createRule', {
        defaultMessage: 'Create new alert rule',
      }),
      description: i18n.translate('xpack.slo.item.actions.createRule', {
        defaultMessage: 'Create new alert rule',
      }),
      'data-test-subj': 'sloActionsCreateRule',
      enabled: (slo: SLOWithSummaryResponse) =>
        !!permissions?.hasAllWriteRequested && !isRemote(slo),
      onClick: (slo: SLOWithSummaryResponse) => {
        setSloToAddRule(slo);
      },
    },
    {
      type: 'icon',
      icon: 'gear',
      name: i18n.translate('xpack.slo.item.actions.manageRules', {
        defaultMessage: 'Manage rules',
      }),
      description: i18n.translate('xpack.slo.item.actions.manageRules', {
        defaultMessage: 'Manage rules',
      }),
      'data-test-subj': 'sloActionsManageRules',
      enabled: (slo: SLOWithSummaryResponse) =>
        !!permissions?.hasAllWriteRequested && !isRemote(slo),
      onClick: (slo: SLOWithSummaryResponse) => {
        const locator = locators.get<RulesParams>(rulesLocatorID);
        locator?.navigate({ params: { sloId: slo.id } }, { replace: false });
      },
    },
    {
      type: 'icon',
      icon: 'copy',
      name: buildActionName(
        i18n.translate('xpack.slo.item.actions.clone', {
          defaultMessage: 'Clone',
        })
      ),
      description: i18n.translate('xpack.slo.item.actions.clone', {
        defaultMessage: 'Clone',
      }),
      'data-test-subj': 'sloActionsClone',
      enabled: (slo: SLOWithSummaryResponse) =>
        (permissions?.hasAllWriteRequested && !isRemote(slo)) || hasRemoteKibanaUrl(slo),
      onClick: (slo: SLOWithSummaryResponse) => {
        navigateToClone(slo);
      },
    },
    {
      type: 'icon',
      icon: 'trash',
      name: buildActionName(
        i18n.translate('xpack.slo.item.actions.delete', {
          defaultMessage: 'Delete',
        })
      ),
      description: i18n.translate('xpack.slo.item.actions.delete', {
        defaultMessage: 'Delete',
      }),
      'data-test-subj': 'sloActionsDelete',
      enabled: (slo: SLOWithSummaryResponse) =>
        (permissions?.hasAllWriteRequested && !isRemote(slo)) || hasRemoteKibanaUrl(slo),
      onClick: (slo: SLOWithSummaryResponse) => {
        const remoteDeleteUrl = createRemoteSloDeleteUrl(slo, spaceId);
        if (!!remoteDeleteUrl) {
          window.open(remoteDeleteUrl, '_blank');
        } else {
          setSloToDelete(slo);
        }
      },
    },
    {
      type: 'icon',
      icon: 'refresh',
      name: buildActionName(
        i18n.translate('xpack.slo.item.actions.reset', {
          defaultMessage: 'Reset',
        })
      ),
      description: i18n.translate('xpack.slo.item.actions.reset', {
        defaultMessage: 'Reset',
      }),
      'data-test-subj': 'sloActionsReset',
      enabled: (slo: SLOWithSummaryResponse) =>
        (permissions?.hasAllWriteRequested && !isRemote(slo)) || hasRemoteKibanaUrl(slo),
      onClick: (slo: SLOWithSummaryResponse) => {
        const remoteResetUrl = createRemoteSloResetUrl(slo, spaceId);
        if (!!remoteResetUrl) {
          window.open(remoteResetUrl, '_blank');
        } else {
          setSloToReset(slo);
        }
      },
    },
  ];

  const columns: Array<EuiBasicTableColumn<SLODefinitionResponse>> = [
    {
      field: 'name',
      name: 'Name',
      width: '15%',
      truncateText: { lines: 2 },
      'data-test-subj': 'sloItem',
      render: (_, slo: SLODefinitionResponse) => {
        return (
          <EuiToolTip position="top" content={slo.name} display="block">
            <EuiText size="s">
              <a data-test-subj="o11ySloListItemLink" href={''}>
                {slo.name}
              </a>
            </EuiText>
          </EuiToolTip>
        );
      },
    },
    {
      field: 'indicator.type',
      name: 'Type',
    },
    {
      field: 'createdAt',
      name: 'Created at',
      dataType: 'date',
    },
    {
      field: 'updatedAt',
      name: 'Updated at',
      dataType: 'date',
    },
    {
      field: 'tags',
      name: 'Tags',
      render: (tags: string[]) => <SloTagsList tags={tags} color="default" />,
    },
    {
      name: 'Actions',
      actions,
      width: '5%',
    },
  ];

  const selection: EuiTableSelectionType<SLODefinitionResponse> = {
    onSelectionChange,
    initialSelected: selectedItems,
  };

  if (!isLoading && !isError && sloList?.results.length === 0) {
    return <SloListEmpty />;
  }

  return (
    <>
      <EuiBasicTable<SLODefinitionResponse>
        items={sloList?.results ?? []}
        columns={columns}
        loading={isLoading}
        noItemsMessage={isLoading ? LOADING_SLOS_LABEL : NO_SLOS_FOUND}
        tableLayout="auto"
        selection={selection}
      />
    </>
  );
}

const LOADING_SLOS_LABEL = i18n.translate('xpack.slo.loadingSlosLabel', {
  defaultMessage: 'Loading SLOs ...',
});

const NO_SLOS_FOUND = i18n.translate('xpack.slo.noSlosFound', { defaultMessage: 'No SLOs found' });
