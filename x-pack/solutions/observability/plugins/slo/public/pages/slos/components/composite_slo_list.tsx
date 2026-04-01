/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { EuiBasicTableColumn } from '@elastic/eui';
import {
  EuiBasicTable,
  EuiBadge,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiConfirmModal,
  type CriteriaWithPagination,
  EuiFieldSearch,
  EuiFilterButton,
  EuiFilterGroup,
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiPopover,
  EuiSelectable,
  EuiSkeletonText,
  EuiSpacer,
  EuiText,
} from '@elastic/eui';
import type { EuiSelectableOption } from '@elastic/eui/src/components/selectable/selectable_option';
import numeral from '@elastic/numeral';
import { i18n } from '@kbn/i18n';
import { paths } from '@kbn/slo-shared-plugin/common/locators/paths';
import type { CompositeSLOMemberSummary, FindCompositeSLOResponse } from '@kbn/slo-schema';
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NOT_AVAILABLE_LABEL } from '../../../../common/i18n';
import { displayStatus } from '../../../components/slo/slo_badges/slo_status_badge';
import { useDeleteCompositeSlo } from '../../../hooks/use_delete_composite_slo';
import { useFetchCompositeHistoricalSummary } from '../../../hooks/use_fetch_composite_historical_summary';
import { useFetchCompositeSloDetails } from '../../../hooks/use_fetch_composite_slo_details';
import {
  useFetchCompositeSloList,
  type CompositeSloSortBy,
  type CompositeSloSortDirection,
} from '../../../hooks/use_fetch_composite_slo_list';
import { useFetchCompositeSloSuggestions } from '../../../hooks/use_fetch_composite_slo_suggestions';
import { useKibana } from '../../../hooks/use_kibana';
import { usePermissions } from '../../../hooks/use_permissions';
import { formatHistoricalData } from '../../../utils/slo/chart_data_formatter';
import { SloSparkline } from './slo_sparkline';

const SLODetailsFlyout = lazy(() => import('../../slo_details/shared_flyout/slo_details_flyout'));

type CompositeSLOItem = FindCompositeSLOResponse['results'][number];

const SORTABLE_FIELDS: Record<string, CompositeSloSortBy> = {
  name: 'name',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

export function CompositeSloList() {
  const {
    uiSettings,
    application: { navigateToUrl },
    http: { basePath },
  } = useKibana().services;
  const percentFormat = uiSettings.get('format:percent:defaultPattern');
  const { data: permissions } = usePermissions();
  const hasWritePermissions = permissions?.hasAllWriteRequested === true;
  const { mutateAsync: deleteCompositeSlo } = useDeleteCompositeSlo();

  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [expandedRows, setExpandedRows] = useState<Record<string, React.ReactNode>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<CompositeSLOItem | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<CompositeSloSortBy>('createdAt');
  const [sortDirection, setSortDirection] = useState<CompositeSloSortDirection>('desc');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleTagSelection = useCallback((options: EuiSelectableOption[]) => {
    const newTags = options.filter((opt) => opt.checked === 'on').map((opt) => opt.label);
    setSelectedTags(newTags);
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch('');
    setDebouncedSearch('');
    setSortBy('createdAt');
    setSortDirection('desc');
    setSelectedTags([]);
    setPage(0);
  }, []);

  const tagsParam = selectedTags.length > 0 ? selectedTags.join(',') : undefined;

  const { data, isLoading, isError } = useFetchCompositeSloList({
    page: page + 1,
    perPage,
    search: debouncedSearch || undefined,
    tags: tagsParam,
    sortBy,
    sortDirection,
  });

  const results = data?.results ?? [];
  const total = data?.total ?? 0;

  const { suggestions } = useFetchCompositeSloSuggestions();
  const availableTags = useMemo(
    () => suggestions?.tags?.map((t) => t.label).sort() ?? [],
    [suggestions]
  );

  const tagOptions: EuiSelectableOption[] = useMemo(
    () =>
      availableTags.map((tag) => ({
        label: tag,
        checked: selectedTags.includes(tag) ? 'on' : undefined,
      })),
    [availableTags, selectedTags]
  );

  const hasActiveFilters = debouncedSearch !== '' || selectedTags.length > 0;

  const compositeIds = useMemo(() => results.map((item) => item.id), [results]);
  const { detailsById, isLoading: isDetailsLoading } = useFetchCompositeSloDetails(compositeIds);
  const { historicalSummaryById, isLoading: isHistoricalLoading } =
    useFetchCompositeHistoricalSummary(compositeIds);

  const toggleExpandRow = useCallback(
    (item: CompositeSLOItem) => {
      setExpandedRows((prev) => {
        const next = { ...prev };
        if (next[item.id]) {
          delete next[item.id];
          return next;
        }

        const details = detailsById.get(item.id);
        if (!details || !details.members?.length) {
          next[item.id] = (
            <EuiText size="s" color="subdued" style={{ padding: 16 }}>
              {i18n.translate('xpack.slo.compositeSloList.noMembers', {
                defaultMessage: 'No member SLI data available',
              })}
            </EuiText>
          );
          return next;
        }

        next[item.id] = (
          <MembersTable members={details.members} percentFormat={percentFormat} />
        );
        return next;
      });
    },
    [detailsById, percentFormat]
  );

  const columns: Array<EuiBasicTableColumn<CompositeSLOItem>> = useMemo(
    () => [
      {
        width: '40px',
        isExpander: true,
        render: (item: CompositeSLOItem) => {
          const isExpanded = !!expandedRows[item.id];
          return (
            <EuiButtonIcon
              data-test-subj={`compositeSloExpandRow-${item.id}`}
              onClick={() => toggleExpandRow(item)}
              aria-label={
                isExpanded
                  ? i18n.translate('xpack.slo.compositeSloList.collapseRow', {
                      defaultMessage: 'Collapse',
                    })
                  : i18n.translate('xpack.slo.compositeSloList.expandRow', {
                      defaultMessage: 'Expand',
                    })
              }
              iconType={isExpanded ? 'arrowDown' : 'arrowRight'}
            />
          );
        },
      },
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
        sortable: true,
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
        name: i18n.translate('xpack.slo.compositeSloList.columns.historicalSli', {
          defaultMessage: 'Historical SLI',
        }),
        width: '80px',
        render: (item: CompositeSLOItem) => {
          const historicalData = historicalSummaryById.get(item.id);
          const details = detailsById.get(item.id);
          const isFailed =
            details?.summary.status === 'VIOLATED' || details?.summary.status === 'DEGRADING';
          return (
            <SloSparkline
              chart="line"
              id={`composite-historical-sli-${item.id}`}
              state={isFailed ? 'error' : 'success'}
              data={formatHistoricalData(historicalData, 'sli_value')}
              isLoading={isHistoricalLoading}
            />
          );
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
          const duration = String(timeWindow.duration);
          return `${duration} (${timeWindow.type})`;
        },
      },
      {
        name: i18n.translate('xpack.slo.compositeSloList.columns.actions', {
          defaultMessage: 'Actions',
        }),
        width: '80px',
        actions: [
          {
            name: i18n.translate('xpack.slo.compositeSloList.actions.edit', {
              defaultMessage: 'Edit',
            }),
            description: i18n.translate('xpack.slo.compositeSloList.actions.editDescription', {
              defaultMessage: 'Edit this composite SLO',
            }),
            icon: 'pencil',
            type: 'icon',
            enabled: () => hasWritePermissions,
            onClick: (item: CompositeSLOItem) => {
              navigateToUrl(basePath.prepend(paths.sloCompositeEdit(item.id)));
            },
            'data-test-subj': 'compositeSloEditAction',
          },
          {
            name: i18n.translate('xpack.slo.compositeSloList.actions.delete', {
              defaultMessage: 'Delete',
            }),
            description: i18n.translate('xpack.slo.compositeSloList.actions.deleteDescription', {
              defaultMessage: 'Delete this composite SLO',
            }),
            icon: 'trash',
            type: 'icon',
            color: 'danger',
            enabled: () => hasWritePermissions,
            onClick: (item: CompositeSLOItem) => {
              setDeleteConfirm(item);
            },
            'data-test-subj': 'compositeSloDeleteAction',
          },
        ],
      },
    ],
    [
      basePath,
      detailsById,
      expandedRows,
      hasWritePermissions,
      historicalSummaryById,
      isHistoricalLoading,
      navigateToUrl,
      percentFormat,
      toggleExpandRow,
    ]
  );

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
    <>
      <EuiFlexGroup gutterSize="m" alignItems="center" responsive={false} wrap>
        <EuiFlexItem grow>
          <EuiFieldSearch
            data-test-subj="compositeSloListSearch"
            placeholder={i18n.translate('xpack.slo.compositeSloList.searchPlaceholder', {
              defaultMessage: 'Search composite SLOs by name...',
            })}
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            isClearable
            fullWidth
            isLoading={isLoading}
          />
        </EuiFlexItem>
        <EuiFlexItem grow={false}>
          <EuiFilterGroup>
            <EuiPopover
              button={
                <EuiFilterButton
                  data-test-subj="compositeSloListTagFilter"
                  iconType="arrowDown"
                  onClick={() => setIsTagPopoverOpen((prev) => !prev)}
                  isSelected={isTagPopoverOpen}
                  numFilters={availableTags.length}
                  hasActiveFilters={selectedTags.length > 0}
                  numActiveFilters={selectedTags.length}
                >
                  {i18n.translate('xpack.slo.compositeSloList.tagsFilter', {
                    defaultMessage: 'Tags',
                  })}
                </EuiFilterButton>
              }
              isOpen={isTagPopoverOpen}
              closePopover={() => setIsTagPopoverOpen(false)}
              panelPaddingSize="none"
            >
              <EuiSelectable
                options={tagOptions}
                onChange={handleTagSelection}
                searchable
                searchProps={{
                  placeholder: i18n.translate('xpack.slo.compositeSloList.tagsSearchPlaceholder', {
                    defaultMessage: 'Search tags',
                  }),
                  compressed: true,
                }}
              >
                {(list, tagSearch) => (
                  <div css={{ width: 240 }}>
                    {tagSearch}
                    {list}
                  </div>
                )}
              </EuiSelectable>
            </EuiPopover>
          </EuiFilterGroup>
        </EuiFlexItem>
        {hasActiveFilters && (
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              data-test-subj="compositeSloListClearFilters"
              size="s"
              iconType="cross"
              onClick={clearFilters}
            >
              {i18n.translate('xpack.slo.compositeSloList.clearFilters', {
                defaultMessage: 'Clear filters',
              })}
            </EuiButtonEmpty>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
      <EuiSpacer size="m" />
      {isLoading ? (
        <EuiFlexGroup justifyContent="center" alignItems="center" style={{ minHeight: 200 }}>
          <EuiFlexItem grow={false}>
            <EuiLoadingSpinner size="xl" />
          </EuiFlexItem>
        </EuiFlexGroup>
      ) : (
        <EuiBasicTable
          data-test-subj="compositeSloList"
          items={results}
          columns={columns}
          itemId="id"
          itemIdToExpandedRowMap={expandedRows}
          rowHeader="name"
          loading={isDetailsLoading}
          sorting={{
            sort: {
              field: sortBy as keyof CompositeSLOItem,
              direction: sortDirection,
            },
          }}
          pagination={{
            pageIndex: page,
            pageSize: perPage,
            totalItemCount: total,
            pageSizeOptions: [10, 25, 50],
          }}
          onChange={({ page: pagination, sort }: CriteriaWithPagination<CompositeSLOItem>) => {
            if (pagination) {
              setPage(pagination.index);
              setPerPage(pagination.size);
            }
            if (sort) {
              const mappedField = SORTABLE_FIELDS[sort.field as string];
              if (mappedField) {
                setSortBy(mappedField);
                setSortDirection(sort.direction);
              }
            }
          }}
          noItemsMessage={i18n.translate('xpack.slo.compositeSloList.noItems', {
            defaultMessage: 'No composite SLOs found',
          })}
        />
      )}
      {deleteConfirm && (
        <EuiConfirmModal
          title={i18n.translate('xpack.slo.compositeSloList.deleteConfirmTitle', {
            defaultMessage: 'Delete "{name}"?',
            values: { name: deleteConfirm.name },
          })}
          onCancel={() => setDeleteConfirm(null)}
          onConfirm={async () => {
            await deleteCompositeSlo({ id: deleteConfirm.id, name: deleteConfirm.name });
            setDeleteConfirm(null);
          }}
          cancelButtonText={i18n.translate('xpack.slo.compositeSloList.deleteConfirmCancel', {
            defaultMessage: 'Cancel',
          })}
          confirmButtonText={i18n.translate('xpack.slo.compositeSloList.deleteConfirmButton', {
            defaultMessage: 'Delete',
          })}
          buttonColor="danger"
          data-test-subj="compositeSloDeleteConfirmModal"
        >
          {i18n.translate('xpack.slo.compositeSloList.deleteConfirmBody', {
            defaultMessage:
              'This will permanently delete this composite SLO. The member SLOs will not be affected.',
          })}
        </EuiConfirmModal>
      )}
    </>
  );
}

const getMemberColumns = (
  percentFormat: string
): Array<EuiBasicTableColumn<CompositeSLOMemberSummary>> => [
  {
    field: 'name',
    name: i18n.translate('xpack.slo.compositeSloList.members.name', {
      defaultMessage: 'Member SLO',
    }),
    truncateText: true,
    width: '220px',
  },
  {
    field: 'instanceId',
    name: i18n.translate('xpack.slo.compositeSloList.members.instanceId', {
      defaultMessage: 'Instance',
    }),
    width: '220px',
    render: (instanceId?: string) => instanceId ?? NOT_AVAILABLE_LABEL,
  },
  {
    field: 'weight',
    name: i18n.translate('xpack.slo.compositeSloList.members.weight', {
      defaultMessage: 'Weight',
    }),
    width: '80px',
  },
  {
    field: 'normalisedWeight',
    name: i18n.translate('xpack.slo.compositeSloList.members.normalisedWeight', {
      defaultMessage: 'Normalised weight',
    }),
    width: '140px',
    render: (value: number) =>
      value === -1 ? NOT_AVAILABLE_LABEL : numeral(value).format(percentFormat),
  },
  {
    field: 'sliValue',
    name: i18n.translate('xpack.slo.compositeSloList.members.sliValue', {
      defaultMessage: 'SLI value',
    }),
    width: '100px',
    render: (value: number) =>
      value === -1 ? NOT_AVAILABLE_LABEL : numeral(value).format(percentFormat),
  },
  {
    field: 'contribution',
    name: i18n.translate('xpack.slo.compositeSloList.members.contribution', {
      defaultMessage: 'Contribution',
    }),
    width: '110px',
    render: (value: number) => numeral(value).format(percentFormat),
  },
];

function MembersTable({
  members,
  percentFormat,
}: {
  members: CompositeSLOMemberSummary[];
  percentFormat: string;
}) {
  const columns = useMemo(() => getMemberColumns(percentFormat), [percentFormat]);
  const [selectedMember, setSelectedMember] = useState<CompositeSLOMemberSummary | null>(null);

  return (
    <div css={{ padding: '16px' }}>
      <EuiBasicTable
        tableCaption={i18n.translate('xpack.slo.compositeSloList.members.tableCaption', {
          defaultMessage: 'Member SLOs',
        })}
        data-test-subj="compositeSloMembersTable"
        items={members}
        columns={columns}
        itemId="id"
        compressed
        rowProps={(item: CompositeSLOMemberSummary) => ({
          onClick: () => setSelectedMember(item),
          style: { cursor: 'pointer' },
        })}
      />
      {selectedMember && (
        <Suspense fallback={<EuiLoadingSpinner size="m" />}>
          <SLODetailsFlyout
            sloId={selectedMember.id}
            sloInstanceId={selectedMember.instanceId}
            onClose={() => setSelectedMember(null)}
          />
        </Suspense>
      )}
    </div>
  );
}
