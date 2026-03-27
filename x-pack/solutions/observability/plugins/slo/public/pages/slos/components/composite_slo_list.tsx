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
  EuiText,
} from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import type { FindCompositeSLOResponse } from '@kbn/slo-schema';
import React, { useState } from 'react';
import { useFetchCompositeSloList } from '../../../hooks/use_fetch_composite_slo_list';

type CompositeSLOItem = FindCompositeSLOResponse['results'][number];

const columns: Array<EuiBasicTableColumn<CompositeSLOItem>> = [
  {
    field: 'name',
    name: i18n.translate('xpack.slo.compositeSloList.columns.name', {
      defaultMessage: 'Name',
    }),
    truncateText: true,
    sortable: true,
  },
  {
    field: 'objective',
    name: i18n.translate('xpack.slo.compositeSloList.columns.objective', {
      defaultMessage: 'Objective',
    }),
    width: '120px',
    render: (objective: CompositeSLOItem['objective']) => `${(objective.target * 100).toFixed(2)}%`,
  },
  {
    field: 'timeWindow',
    name: i18n.translate('xpack.slo.compositeSloList.columns.timeWindow', {
      defaultMessage: 'Time window',
    }),
    width: '140px',
    render: (timeWindow: Record<string, unknown>) => {
      const duration = timeWindow.duration as Record<string, unknown>;
      return `${duration.value}${duration.unit} (${timeWindow.type})`;
    },
  },
  {
    field: 'members',
    name: i18n.translate('xpack.slo.compositeSloList.columns.members', {
      defaultMessage: 'Members',
    }),
    width: '100px',
    render: (members: CompositeSLOItem['members']) => members.length,
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
    field: 'enabled',
    name: i18n.translate('xpack.slo.compositeSloList.columns.status', {
      defaultMessage: 'Status',
    }),
    width: '100px',
    render: (enabled: boolean) => (
      <EuiBadge color={enabled ? 'success' : 'default'}>
        {enabled
          ? i18n.translate('xpack.slo.compositeSloList.enabled', { defaultMessage: 'Enabled' })
          : i18n.translate('xpack.slo.compositeSloList.disabled', { defaultMessage: 'Disabled' })}
      </EuiBadge>
    ),
  },
];

export const CompositeSloList = () => {
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);

  const { data, isLoading, isError } = useFetchCompositeSloList({
    page: page + 1,
    perPage,
  });

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

  const results = data?.results ?? [];
  const total = data?.total ?? 0;

  return (
    <EuiBasicTable
      data-test-subj="compositeSloList"
      items={results}
      columns={columns}
      rowHeader="name"
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
