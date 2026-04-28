/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment/moment';
import datemath from '@kbn/datemath';
import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import type { SavedObjectsFindResult } from '@kbn/core-saved-objects-api-server';
import { isEmpty } from 'lodash';
import { withApmSpan } from '@kbn/apm-data-access-plugin/server/utils/with_apm_span';
import { ALL_SPACES_ID } from '@kbn/security-plugin/common/constants';
import { asMutableArray } from '../../../common/utils/as_mutable_array';
import type { OverviewStatusQuery } from '../common';
import { getMonitorFilters } from '../common';
import { processMonitors } from '../../saved_objects/synthetics_monitor/process_monitors';
import { ConfigKey } from '../../../common/constants/monitor_management';
import type { RouteContext } from '../types';
import type {
  EncryptedSyntheticsMonitorAttributes,
  OverviewStatusMetaData,
} from '../../../common/runtime_types';
import { isStatusEnabled } from '../../../common/runtime_types/monitor_management/alert_config';
import {
  FINAL_SUMMARY_FILTER,
  getRangeFilter,
  getTimespanFilter,
} from '../../../common/constants/client_defaults';

type LocationStatus = Array<{
  status: string;
  locationId: string;
  timestamp: string;
  monitorUrl?: string;
}>;

export const SUMMARIES_PAGE_SIZE = 5000;

export class OverviewStatusService {
  filterData: {
    locationIds?: string[] | string;
    filtersStr?: string;
  } = {};
  constructor(
    private readonly routeContext: RouteContext<Record<string, any>, OverviewStatusQuery>
  ) {}

  async getOverviewStatus() {
    this.filterData = await getMonitorFilters(this.routeContext);

    const [rawConfigs, statusResult] = await Promise.all([
      this.getMonitorConfigs(),
      this.getQueryResult(),
    ]);

    // When the user opts into date-range filtering, drop any configured
    // monitor that has no final summary in the selected window. Disabled
    // monitors (which never run) get filtered out as a side effect — that's
    // intentional: the toggle is about "what ran in the window".
    const filterByDateRange = Boolean(this.routeContext.request.query?.filterByDateRange);
    const allConfigs = filterByDateRange
      ? rawConfigs.filter((c) => statusResult.has(c.attributes[ConfigKey.MONITOR_QUERY_ID]))
      : rawConfigs;

    const { up, down, pending, upConfigs, downConfigs, pendingConfigs, disabledConfigs } =
      this.processOverviewStatus(allConfigs, statusResult);

    const {
      enabledMonitorQueryIds,
      disabledMonitorQueryIds,
      allIds,
      disabledCount,
      disabledMonitorsCount,
      projectMonitorsCount,
    } = processMonitors(allConfigs, this.filterData?.locationIds);

    return {
      allIds,
      allMonitorsCount: allConfigs.length,
      disabledMonitorsCount,
      projectMonitorsCount,
      enabledMonitorQueryIds,
      disabledMonitorQueryIds,
      disabledCount,
      up,
      down,
      pending,
      upConfigs,
      downConfigs,
      pendingConfigs,
      disabledConfigs,
    };
  }

  getEsDataFilters() {
    const { spaceId, request } = this.routeContext;
    const params = request.query || {};
    const {
      scopeStatusByLocation = true,
      tags,
      monitorTypes,
      projects,
      showFromAllSpaces,
    } = params;
    const { locationIds } = this.filterData;
    const getTermFilter = (field: string, value: string | string[] | undefined) => {
      if (!value || isEmpty(value)) {
        return [];
      }
      if (Array.isArray(value)) {
        return [
          {
            terms: {
              [field]: value,
            },
          },
        ];
      }
      return [
        {
          term: {
            [field]: value,
          },
        },
      ];
    };
    const filters: QueryDslQueryContainer[] = [
      ...(showFromAllSpaces ? [] : [{ terms: { 'meta.space_id': [spaceId, ALL_SPACES_ID] } }]),
      ...getTermFilter('monitor.type', monitorTypes),
      ...getTermFilter('tags', tags),
      ...getTermFilter('monitor.project.id', projects),
    ];

    if (scopeStatusByLocation && !isEmpty(locationIds) && locationIds) {
      filters.push({
        terms: {
          'observer.name': locationIds,
        },
      });
    }
    return filters;
  }

  /**
   * Compute the `[from, to]` window we use to pull final-summary docs. By
   * default we look back 4h+20m so we always capture the latest summary for
   * every enabled monitor (max schedule is 4h). When the user has explicitly
   * opted into `filterByDateRange`, we honor their picker range — but we only
   * narrow, never widen below the default window, because the picker can be
   * useful even with `now-15m` style values.
   */
  getStatusQueryRange(): { from: string; to: string } {
    const params = this.routeContext.request.query || {};
    const { filterByDateRange, dateRangeStart, dateRangeEnd } = params;
    const defaultFrom = moment().subtract(4, 'hours').subtract(20, 'minutes').toISOString();

    if (!filterByDateRange || !dateRangeStart || !dateRangeEnd) {
      return { from: defaultFrom, to: 'now' };
    }

    // Datemath returns undefined on bad input; fall back to defaults rather
    // than failing the query.
    const fromDate = datemath.parse(dateRangeStart);
    const toDate = datemath.parse(dateRangeEnd, { roundUp: true });
    if (!fromDate?.isValid() || !toDate?.isValid()) {
      return { from: defaultFrom, to: 'now' };
    }

    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    };
  }

  async getQueryResult() {
    return withApmSpan('monitor_status_data', async () => {
      const range = this.getStatusQueryRange();

      let hasMoreData = true;
      const monitorByIds = new Map<string, LocationStatus>();
      let afterKey: any;
      let count = 0;

      // The `timespan` filter is a "currently fresh" constraint anchored to
      // `now` — when the user is explicitly inspecting a historic window via
      // the date picker we drop it, otherwise older summaries inside the
      // window would be filtered out unfairly.
      const isUserSelectedRange = Boolean(this.routeContext.request.query?.filterByDateRange);

      do {
        const result = await this.routeContext.syntheticsEsClient.search(
          {
            size: 0,
            query: {
              bool: {
                filter: [
                  FINAL_SUMMARY_FILTER,
                  getRangeFilter({ from: range.from, to: range.to }),
                  ...(isUserSelectedRange
                    ? []
                    : [getTimespanFilter({ from: 'now-15m', to: 'now' })]),
                  ...this.getEsDataFilters(),
                ] as QueryDslQueryContainer[],
              },
            },
            aggs: {
              monitors: {
                composite: {
                  size: SUMMARIES_PAGE_SIZE,
                  sources: asMutableArray([
                    {
                      monitorId: {
                        terms: {
                          field: 'monitor.id',
                        },
                      },
                    },
                    {
                      locationId: {
                        terms: {
                          field: 'observer.name',
                        },
                      },
                    },
                  ] as const),
                  after: afterKey,
                },
                aggs: {
                  status: {
                    top_metrics: {
                      metrics: [
                        {
                          field: 'monitor.status',
                        },
                        {
                          field: 'url.full.keyword',
                        },
                      ],
                      sort: {
                        '@timestamp': 'desc',
                      },
                    },
                  },
                },
              },
            },
          },
          'getCurrentStatusOverview' + count
        );
        count += 1;
        const data = result.body.aggregations?.monitors;

        hasMoreData = (data?.buckets ?? []).length >= SUMMARIES_PAGE_SIZE;
        afterKey = data?.after_key;

        data?.buckets.forEach(({ status: statusAgg, key: bKey }) => {
          const monitorId = String(bKey.monitorId);
          const locationId = String(bKey.locationId);
          const status = String(statusAgg.top?.[0].metrics?.['monitor.status']);
          const monitorUrl = statusAgg.top?.[0].metrics?.['url.full.keyword'];

          const timestamp = String(statusAgg.top[0].sort[0]);
          if (!monitorByIds.has(String(monitorId))) {
            monitorByIds.set(monitorId, []);
          }
          monitorByIds.get(monitorId)?.push({
            status,
            locationId,
            timestamp,
            monitorUrl: monitorUrl ? String(monitorUrl) : undefined,
          });
        });
      } while (hasMoreData && afterKey);
      return monitorByIds;
    });
  }

  processOverviewStatus(
    monitors: Array<
      SavedObjectsFindResult<EncryptedSyntheticsMonitorAttributes & { [ConfigKey.URLS]?: string }>
    >,
    statusData: Map<string, LocationStatus>
  ) {
    let up = 0;
    let down = 0;
    const upConfigs: Record<string, OverviewStatusMetaData> = {};
    const downConfigs: Record<string, OverviewStatusMetaData> = {};
    const pendingConfigs: Record<string, OverviewStatusMetaData> = {};
    const disabledConfigs: Record<string, OverviewStatusMetaData> = {};

    const enabledMonitors = monitors.filter((monitor) => monitor.attributes[ConfigKey.ENABLED]);
    const disabledMonitors = monitors.filter((monitor) => !monitor.attributes[ConfigKey.ENABLED]);

    const queryLocIds = this.filterData?.locationIds;

    disabledMonitors.forEach((monitor) => {
      const monitorQueryId = monitor.attributes[ConfigKey.MONITOR_QUERY_ID];
      const meta = this.getMonitorMeta(monitor);
      monitor.attributes[ConfigKey.LOCATIONS]?.forEach((location) => {
        disabledConfigs[`${meta.configId}-${location.id}`] = {
          monitorQueryId,
          status: 'disabled',
          locationId: location.id,
          locationLabel: location.label,
          ...meta,
        };
      });
    });

    enabledMonitors.forEach((monitor) => {
      const monitorId = monitor.attributes[ConfigKey.MONITOR_QUERY_ID];
      const monitorStatus = statusData.get(monitorId);

      // discard any locations that are not in the monitorLocationsMap for the given monitor as well as those which are
      // in monitorLocationsMap but not in listOfLocations
      const monLocations = monitor.attributes[ConfigKey.LOCATIONS];
      monLocations?.forEach((monLocation) => {
        if (!isEmpty(queryLocIds) && !queryLocIds?.includes(monLocation.id)) {
          // filter out location provided via query
          return;
        }
        const locData = monitorStatus?.find((loc) => loc.locationId === monLocation.id);
        const metaInfo = this.getMonitorMeta(monitor);
        const meta = {
          ...metaInfo,
          monitorQueryId: monitorId,
          locationId: monLocation.id,
          timestamp: locData?.timestamp,
          locationLabel: monLocation.label,
          urls: monitor.attributes[ConfigKey.URLS] || locData?.monitorUrl,
        };
        const monLocId = `${meta.configId}-${monLocation.id}`;
        if (locData) {
          if (locData.status === 'down') {
            down += 1;
            downConfigs[monLocId] = {
              ...meta,
              status: 'down',
            };
          } else if (locData.status === 'up') {
            up += 1;
            upConfigs[monLocId] = {
              ...meta,
              status: 'up',
            };
          }
        } else {
          pendingConfigs[monLocId] = {
            status: 'unknown',
            ...meta,
          };
        }
      });
    });

    return {
      up,
      down,
      pending: Object.values(pendingConfigs).length,
      upConfigs,
      downConfigs,
      pendingConfigs,
      disabledConfigs,
    };
  }

  async getMonitorConfigs() {
    const { request } = this.routeContext;
    const { query, showFromAllSpaces } = request.query || {};
    /**
     * Walk through all monitor saved objects, bucket IDs by disabled/enabled status.
     *
     * Track max period to make sure the snapshot query should reach back far enough to catch
     * latest ping for all enabled monitors.
     */

    const { filtersStr } = this.filterData;

    return this.routeContext.monitorConfigRepository.getAll<
      EncryptedSyntheticsMonitorAttributes & { [ConfigKey.URLS]?: string }
    >({
      showFromAllSpaces,
      search: query,
      filter: filtersStr,
      fields: [
        ConfigKey.ENABLED,
        ConfigKey.LOCATIONS,
        ConfigKey.MONITOR_QUERY_ID,
        ConfigKey.CONFIG_ID,
        ConfigKey.SCHEDULE,
        ConfigKey.MONITOR_SOURCE_TYPE,
        ConfigKey.MONITOR_TYPE,
        ConfigKey.NAME,
        ConfigKey.TAGS,
        ConfigKey.PROJECT_ID,
        ConfigKey.ALERT_CONFIG,
        ConfigKey.URLS,
        ConfigKey.MAINTENANCE_WINDOWS,
      ],
    });
  }

  getMonitorMeta(
    monitor: SavedObjectsFindResult<
      EncryptedSyntheticsMonitorAttributes & { [ConfigKey.URLS]?: string }
    >
  ) {
    return {
      name: monitor.attributes[ConfigKey.NAME],
      configId: monitor.attributes[ConfigKey.CONFIG_ID],
      schedule: monitor.attributes[ConfigKey.SCHEDULE].number,
      tags: monitor.attributes[ConfigKey.TAGS],
      isEnabled: monitor.attributes[ConfigKey.ENABLED],
      type: monitor.attributes[ConfigKey.MONITOR_TYPE],
      projectId: monitor.attributes[ConfigKey.PROJECT_ID],
      isStatusAlertEnabled: isStatusEnabled(monitor.attributes[ConfigKey.ALERT_CONFIG]),
      updated_at: monitor.updated_at,
      spaces: monitor.namespaces,
      urls: monitor.attributes[ConfigKey.URLS],
      maintenanceWindows: monitor.attributes[ConfigKey.MAINTENANCE_WINDOWS]?.map((mw) => mw),
    };
  }
}
