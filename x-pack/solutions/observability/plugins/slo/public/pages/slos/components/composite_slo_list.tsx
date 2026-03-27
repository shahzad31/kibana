/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  EuiBasicTable,
  EuiBasicTableColumn,
  EuiBadge,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiSkeletonText,
  EuiText,
} from '@elastic/eui';
import numeral from '@elastic/numeral';
import { i18n } from '@kbn/i18n';
import type { FindCompositeSLOResponse } from '@kbn/slo-schema';
import React, { useMemo, useState } from 'react';
import { NOT_AVAILABLE_LABEL } from '../../../../common/i18n';
import { displayStatus } from '../../../components/slo/slo_badges/slo_status_badge';
import { useFetchCompositeSloDetails } from '../../../hooks/use_fetch_composite_slo_details';
import { useFetchCompositeSloList } from '../../../hooks/use_fetch_composite_slo_list';
import { useKibana } from '../../../hooks/use_kibana';

type CompositeSLOItem = FindCompositeSLOResponse['results'][number];

export const CompositeSloList = () => {
  const {
    uiSettings,
  } = useKibana().services;
  const percentFormat = uiSettings.get('format:percent:defaultPattern');

  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);

  const { data, isLoading, isError } = useFetchCompositeSloList({
    page: page + 1,
    perPage,
  });

  const results = data?.results ?? [];
  const total = data?.total ?? 0;

  const compositeIds = useMemo(() => results.map((item) => item.id), [results]);
  const { detailsById, isLoading: isDetailsLoading } =
    useFetchCompositeSloDetails(compositeIds);

  const columns: Array<EuiBasicTableColumn<CompositeSLOItem>> = useMemo(
    () => [
      {
        field: 'summary.status',
        name: i18n.translate('xpack.slo.compositeSloList.columns.status', {
          defaultMessage: 'Status',
        }),
        width: '100px',
        render: (_: unknown, item: CompositeSLOItem) => {
          const details = detailsById.get(item.id);
          if (!details) {
            return <EuiSkeletonText lines={1} />;
          }
          const { status } = details.summary;
          const statusInfo = displayStatus[status as keyof typeof displayStatus];
          return statusInfo ? (
            <EuiBadge color={statusInfo.badgeColor}>{statusInfo.displayText}</EuiBadge>
          ) : null;
        },
      },
      {
        field: 'name',
        name: i18n.translate('xpack.slo.compositeSloList.columns.name', {
          defaultMessage: 'Name',
        }),
        truncateText: true,
      },
      {
        field: 'tags',
        name: i18n.translate('xpack.slo.compositeSloList.columns.tags', {
          defaultMessage: 'Tags',
        }),
        render: (tags: string[]) => (
          <EuiFlexGroup gutterSize="xs" wrap responsive={false}>
            {tags.map((tag) => (
              <EuiFlexItem grow={false} key={tag}>
                <EuiBadge color="hollow">{tag}</EuiBadge>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        ),
      },
      {
        field: 'members',
        name: i18n.translate('xpack.slo.compositeSloList.columns.members', {
          defaultMessage: 'Members',
        }),
        width: '90px',
        render: (members: CompositeSLOItem['members']) => members.length,
      },
      {
        field: 'objective',
        name: i18n.translate('xpack.slo.compositeSloList.columns.objective', {
          defaultMessage: 'Objective',
        }),
        width: '100px',
        render: (objective: CompositeSLOItem['objective']) =>
          numeral(objective.target).format('0.00%'),
      },
      {
        field: 'summary.sliValue',
        name: i18n.translate('xpack.slo.compositeSloList.columns.sliValue', {
          defaultMessage: 'SLI value',
        }),
        width: '100px',
        render: (_: unknown, item: CompositeSLOItem) => {
          const details = detailsById.get(item.id);
          if (!details) {
            return <EuiSkeletonText lines={1} />;
          }
          return details.summary.status === 'NO_DATA'
            ? NOT_AVAILABLE_LABEL
            : numeral(details.summary.sliValue).format(percentFormat);
        },
      },
      {
        field: 'summary.errorBudget.remaining',
        name: i18n.translate('xpack.slo.compositeSloList.columns.budgetRemaining', {
          defaultMessage: 'Budget remaining',
        }),
        width: '140px',
        render: (_: unknown, item: CompositeSLOItem) => {
          const details = detailsById.get(item.id);
          if (!details) {
            return <EuiSkeletonText lines={1} />;
          }
          return details.summary.status === 'NO_DATA'
            ? NOT_AVAILABLE_LABEL
            : numeral(details.summary.errorBudget.remaining).format(percentFormat);
        },
      },
      {
        field: 'timeWindow',
        name: i18n.translate('xpack.slo.compositeSloList.columns.timeWindow', {
          defaultMessage: 'Time window',
        }),
        width: '120px',
        render: (timeWindow: Record<string, unknown>) => {
          const duration = timeWindow.duration as Record<string, unknown>;
          return `${duration.value}${duration.unit} (${timeWindow.type})`;
        },
      },
    ],
    [detailsById, percentFormat]
  );

  if (isLoading) {
    return (
      <EuiFlexGroup justifyContent="center" alignItems="center" style={{ minHeight: 200 }}>
        <EuiFlexItem grow={false}>
          <EuiLoadingSpinner size="xl" />
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  if (isError) {
    return (
      <EuiText color="danger">
        {i18n.translate('xpack.slo.compositeSloList.errorMessage', {
          defaultMessage: 'Unable to load composite SLOs',
        })}
      </EuiText>
    );
  }

  return (
    <EuiBasicTable
      data-test-subj="compositeSloList"
      items={results}
      columns={columns}
      rowHeader="name"
      loading={isDetailsLoading}
      pagination={{
        pageIndex: page,
        pageSize: perPage,
        totalItemCount: total,
        pageSizeOptions: [10, 25, 50],
      }}
      onChange={({ page: pagination }) => {
        if (pagination) {
          setPage(pagination.pageIndex);
          setPerPage(pagination.pageSize);
        }
      }}
      noItemsMessage={i18n.translate('xpack.slo.compositeSloList.noItems', {
        defaultMessage: 'No composite SLOs found',
      })}
    />
  );
};
