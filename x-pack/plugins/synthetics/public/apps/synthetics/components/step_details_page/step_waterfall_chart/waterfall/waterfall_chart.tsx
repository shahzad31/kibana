/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { TickFormatter, DomainRange } from '@elastic/charts';
import { EuiFlexGroup, EuiFlexItem, useEuiTheme } from '@elastic/eui';

import { useWaterfallContext } from './context/waterfall_context';
import { WaterfallSearch } from './waterfall_header/waterfall_search';
import { WaterfallLegend } from './waterfall_header/waterfall_legend';
import { WaterfallTickAxis } from './waterfall_header/waterfall_tick_axis';

import {
  WaterfallChartOuterContainer,
  WaterfallChartStickyHeaderContainer,
  WaterfallChartSidebarWrapper,
} from './styles';
import { MAIN_GROW_SIZE, SIDEBAR_GROW_SIZE } from './constants';
import { Sidebar } from './sidebar';
import { useBarCharts } from './use_bar_charts';
import { WaterfallBarChart } from './waterfall_bar_chart';

export type RenderItem<I = any> = (
  item: I,
  index: number,
  onClick?: (event: any) => void
) => JSX.Element;
export type RenderSideBarItem<I = any> = (item: I) => JSX.Element;
export type RenderElement = () => JSX.Element;

export interface WaterfallChartProps {
  tickFormat: TickFormatter;
  domain: DomainRange;
  renderLegendItem?: RenderItem;
  renderFlyout?: RenderElement;
}

export const WaterfallChart = ({ tickFormat, domain, renderFlyout }: WaterfallChartProps) => {
  const { euiTheme } = useEuiTheme();
  const {
    data,
    query,
    setQuery,
    sidebarItems,
    activeFilters,
    setActiveFilters,
    showOnlyHighlightedNetworkRequests,
    setOnlyHighlighted,
    totalNetworkRequests,
    highlightedNetworkRequests,
    fetchedNetworkRequests,
  } = useWaterfallContext();

  const chartsToDisplay = useBarCharts({ data });
  const cancelPagePadding = {
    marginLeft: `-${euiTheme.size.l}`,
    marginRight: `-${euiTheme.size.l}`,
  };

  return (
    <div style={{ position: 'relative', ...cancelPagePadding }}>
      <WaterfallChartStickyHeaderContainer
        data-test-sub="syntheticsWaterfallChartStickyHeaderContainer"
        style={{ background: euiTheme.colors.body }}
      >
        <EuiFlexGroup
          style={{ height: '100%' }}
          gutterSize="s"
          alignItems="stretch"
          responsive={false}
        >
          <WaterfallChartSidebarWrapper grow={SIDEBAR_GROW_SIZE}>
            <WaterfallSearch
              query={query}
              setQuery={setQuery}
              totalNetworkRequests={totalNetworkRequests}
              highlightedNetworkRequests={highlightedNetworkRequests}
              fetchedNetworkRequests={fetchedNetworkRequests}
            />
          </WaterfallChartSidebarWrapper>
          <EuiFlexItem grow={MAIN_GROW_SIZE}>
            <WaterfallLegend activeFilters={activeFilters} setActiveFilters={setActiveFilters} />
          </EuiFlexItem>
        </EuiFlexGroup>

        <WaterfallTickAxis
          showOnlyHighlightedNetworkRequests={showOnlyHighlightedNetworkRequests}
          setOnlyHighlighted={setOnlyHighlighted}
          highlightedNetworkRequests={highlightedNetworkRequests}
          fetchedNetworkRequests={fetchedNetworkRequests}
          shouldRenderSidebar={true}
          domain={domain}
          tickFormat={tickFormat}
        />
      </WaterfallChartStickyHeaderContainer>

      <WaterfallChartOuterContainer data-test-subj="syntheticsWaterfallChartOuterContainer">
        <EuiFlexGroup gutterSize="none" responsive={false}>
          <Sidebar items={sidebarItems!} />
          <EuiFlexItem
            style={{ marginLeft: '-24px' }}
            grow={MAIN_GROW_SIZE}
            data-test-subj="dataOnlyWrapper"
          >
            {chartsToDisplay.map((chartData, ind) => (
              <WaterfallBarChart
                index={ind}
                key={ind}
                chartData={chartData}
                domain={domain}
                tickFormat={tickFormat}
              />
            ))}
          </EuiFlexItem>
        </EuiFlexGroup>
      </WaterfallChartOuterContainer>
      {renderFlyout && renderFlyout()}
    </div>
  );
};
