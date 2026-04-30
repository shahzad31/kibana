/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import {
  EXCLUDE_RUN_ONCE_FILTER,
  SUMMARY_FILTER,
  getQueryFilters,
} from '../../common/constants/client_defaults';
import type { SyntheticsEsClient } from '../lib';
import type {
  ErrorStats,
  ErrorInsights,
  LocationErrorStat,
  TopFailingMonitor,
  FailingDomain,
  TagErrorStat,
  StatusCodeStat,
  MonitorTypeStat,
  EmergingTerm,
} from '../../common/runtime_types';

interface GetErrorStatsParams {
  syntheticsEsClient: SyntheticsEsClient;
  from: string;
  to: string;
  monitorTypes?: string[];
  locations?: string[];
  tags?: string[];
  projects?: string[];
  query?: string;
}

/**
 * Computes the mirror previous period for trend comparison.
 * E.g. "now-24h" to "now" → previous period is "now-48h" to "now-24h".
 */
function getPreviousPeriod(from: string, to: string): { prevFrom: string; prevTo: string } {
  const toMs = to === 'now' ? Date.now() : new Date(to).getTime();
  const fromMs = from.startsWith('now-') ? toMs - parseDuration(from) : new Date(from).getTime();
  const durationMs = toMs - fromMs;

  const prevToMs = fromMs;
  const prevFromMs = prevToMs - durationMs;

  return {
    prevFrom: new Date(prevFromMs).toISOString(),
    prevTo: new Date(prevToMs).toISOString(),
  };
}

function parseDuration(nowMinus: string): number {
  const match = nowMinus.match(/^now-(\d+)([smhdwMy])$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const [, value, unit] = match;
  const n = parseInt(value, 10);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    M: 30 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };
  return n * (multipliers[unit] ?? 24 * 60 * 60 * 1000);
}

export async function getErrorStats({
  syntheticsEsClient,
  from,
  to,
  monitorTypes,
  locations,
  tags,
  projects,
  query,
}: GetErrorStatsParams): Promise<ErrorStats> {
  const { prevFrom, prevTo } = getPreviousPeriod(from, to);

  const baseFilters: QueryDslQueryContainer[] = [
    SUMMARY_FILTER as QueryDslQueryContainer,
    EXCLUDE_RUN_ONCE_FILTER as QueryDslQueryContainer,
  ];

  if (monitorTypes?.length) {
    baseFilters.push({ terms: { 'monitor.type': monitorTypes } });
  }
  if (locations?.length) {
    baseFilters.push({ terms: { 'observer.geo.name': locations } });
  }
  if (tags?.length) {
    baseFilters.push({ terms: { tags } });
  }
  if (projects?.length) {
    baseFilters.push({ terms: { 'monitor.project.id': projects } });
  }

  const must: QueryDslQueryContainer[] = [];
  if (query) {
    must.push(getQueryFilters(query) as QueryDslQueryContainer);
  }

  const result = await syntheticsEsClient.search(
    {
      size: 0,
      query: {
        bool: {
          filter: [...baseFilters, { range: { '@timestamp': { gte: prevFrom, lte: to } } }],
          ...(must.length ? { must } : {}),
        },
      },
      aggs: {
        current: {
          filter: { range: { '@timestamp': { gte: from, lte: to } } },
          aggs: {
            down_checks: {
              filter: { term: { 'monitor.status': 'down' } },
              aggs: {
                affected_monitors: { cardinality: { field: 'config_id' } },
                error_states: { cardinality: { field: 'state.id' } },
                avg_duration: { avg: { field: 'state.duration_ms' } },
                by_location: {
                  terms: { field: 'observer.geo.name', size: 50 },
                },
                error_categories: {
                  categorize_text: {
                    field: 'error.message',
                    size: 20,
                  },
                },
              },
            },
            total_monitors: { cardinality: { field: 'config_id' } },
            per_monitor: {
              terms: {
                field: 'config_id',
                size: 20,
                order: { down: 'desc' as const },
              },
              aggs: {
                down: {
                  filter: { term: { 'monitor.status': 'down' } },
                },
                monitor_info: {
                  top_hits: {
                    size: 1,
                    _source: ['monitor.name', 'config_id'],
                    sort: [{ '@timestamp': { order: 'desc' } }],
                  },
                },
                downtime: {
                  filter: { term: { 'monitor.status': 'down' } },
                  aggs: {
                    per_state: {
                      terms: { field: 'state.id', size: 100 },
                      aggs: {
                        duration: { max: { field: 'state.duration_ms' } },
                      },
                    },
                    total_ms: {
                      sum_bucket: { buckets_path: 'per_state>duration' },
                    },
                  },
                },
              },
            },
            // --- Insights aggregations ---
            failing_domains: {
              filter: { term: { 'monitor.status': 'down' } },
              aggs: {
                domains: {
                  terms: { field: 'url.domain', size: 10 },
                },
              },
            },
            by_tag: {
              terms: { field: 'tags', size: 20 },
              aggs: {
                down: {
                  filter: { term: { 'monitor.status': 'down' } },
                },
              },
            },
            status_codes: {
              filter: { term: { 'monitor.status': 'down' } },
              aggs: {
                codes: {
                  terms: { field: 'http.response.status_code', size: 10 },
                },
              },
            },
            by_monitor_type: {
              terms: { field: 'monitor.type', size: 10 },
              aggs: {
                down: {
                  filter: { term: { 'monitor.status': 'down' } },
                },
              },
            },
          },
        },
        previous: {
          filter: { range: { '@timestamp': { gte: prevFrom, lte: prevTo } } },
          aggs: {
            down_checks: {
              filter: { term: { 'monitor.status': 'down' } },
              aggs: {
                error_categories: {
                  categorize_text: {
                    field: 'error.message',
                    size: 25,
                  },
                },
              },
            },
          },
        },
      },
    },
    'getErrorStats'
  );

  const aggs = result.body.aggregations as any;

  const currentTotal = aggs?.current?.doc_count ?? 0;
  const currentDown = aggs?.current?.down_checks?.doc_count ?? 0;
  const currentErrorRate = currentTotal > 0 ? currentDown / currentTotal : 0;

  const prevTotal = aggs?.previous?.doc_count ?? 0;
  const prevDown = aggs?.previous?.down_checks?.doc_count ?? 0;
  const previousErrorRate = prevTotal > 0 ? prevDown / prevTotal : 0;

  const locationBuckets = aggs?.current?.down_checks?.by_location?.buckets ?? [];
  const locationStats: LocationErrorStat[] = locationBuckets.map((bucket: any) => ({
    location: bucket.key as string,
    count: bucket.doc_count as number,
  }));

  const monitorBuckets = aggs?.current?.per_monitor?.buckets ?? [];
  const topFailingMonitors: TopFailingMonitor[] = monitorBuckets
    .filter((bucket: any) => bucket.down?.doc_count > 0)
    .map((bucket: any) => {
      const totalForMonitor = bucket.doc_count as number;
      const downForMonitor = bucket.down?.doc_count as number;
      const source = bucket.monitor_info?.hits?.hits?.[0]?._source;
      return {
        configId: bucket.key as string,
        monitorName: source?.monitor?.name ?? bucket.key,
        downChecks: downForMonitor,
        totalChecks: totalForMonitor,
        errorRate:
          totalForMonitor > 0 ? Math.round((downForMonitor / totalForMonitor) * 10000) / 10000 : 0,
        downtimeMs: bucket.downtime?.total_ms?.value ?? 0,
      };
    });

  // --- Insights ---
  const domainBuckets = aggs?.current?.failing_domains?.domains?.buckets ?? [];
  const failingDomains: FailingDomain[] = domainBuckets.map((b: any) => ({
    domain: b.key as string,
    count: b.doc_count as number,
  }));

  const tagBuckets = aggs?.current?.by_tag?.buckets ?? [];
  const tagStats: TagErrorStat[] = tagBuckets
    .filter((b: any) => b.down?.doc_count > 0)
    .map((b: any) => {
      const total = b.doc_count as number;
      const down = b.down?.doc_count as number;
      return {
        tag: b.key as string,
        downChecks: down,
        totalChecks: total,
        errorRate: total > 0 ? Math.round((down / total) * 10000) / 10000 : 0,
      } satisfies TagErrorStat;
    })
    .sort((a: TagErrorStat, b: TagErrorStat) => b.downChecks - a.downChecks);

  const codeBuckets = aggs?.current?.status_codes?.codes?.buckets ?? [];
  const statusCodes: StatusCodeStat[] = codeBuckets.map((b: any) => ({
    statusCode: b.key as number,
    count: b.doc_count as number,
  }));

  const monitorTypeBuckets = aggs?.current?.by_monitor_type?.buckets ?? [];
  const monitorTypeStats: MonitorTypeStat[] = monitorTypeBuckets
    .map((b: any) => {
      const total = b.doc_count as number;
      const down = b.down?.doc_count as number;
      return {
        monitorType: b.key as string,
        downChecks: down,
        totalChecks: total,
        errorRate: total > 0 ? Math.round((down / total) * 10000) / 10000 : 0,
      } satisfies MonitorTypeStat;
    })
    .sort((a: MonitorTypeStat, b: MonitorTypeStat) => b.downChecks - a.downChecks);

  const currentCategories = aggs?.current?.down_checks?.error_categories?.buckets ?? [];
  const prevCategories = aggs?.previous?.down_checks?.error_categories?.buckets ?? [];
  const prevCategoryKeys = new Set(prevCategories.map((b: any) => b.key as string));

  const emergingTerms: EmergingTerm[] = currentCategories
    .filter((b: any) => !prevCategoryKeys.has(b.key as string))
    .slice(0, 8)
    .map((b: any) => ({
      term: b.key as string,
      score: b.doc_count as number,
      foregroundCount: b.doc_count as number,
      backgroundCount: 0,
    }));

  const insights: ErrorInsights = {
    failingDomains,
    tagStats,
    statusCodes,
    monitorTypeStats,
    emergingTerms,
  };

  return {
    totalChecks: currentTotal,
    downChecks: currentDown,
    errorRate: Math.round(currentErrorRate * 10000) / 10000,
    affectedMonitors: aggs?.current?.down_checks?.affected_monitors?.value ?? 0,
    totalMonitors: aggs?.current?.total_monitors?.value ?? 0,
    errorCount: aggs?.current?.down_checks?.error_states?.value ?? 0,
    avgDurationMs: aggs?.current?.down_checks?.avg_duration?.value ?? 0,
    previousErrorRate: Math.round(previousErrorRate * 10000) / 10000,
    errorRateDelta: Math.round((currentErrorRate - previousErrorRate) * 10000) / 10000,
    locationStats,
    topFailingMonitors,
    insights,
  };
}
