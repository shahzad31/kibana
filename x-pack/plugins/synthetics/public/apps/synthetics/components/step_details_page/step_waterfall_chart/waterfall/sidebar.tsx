/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiPanel, EuiFlexGroup, useEuiTheme } from '@elastic/eui';
import { useSelector } from 'react-redux';
import { WaterfallSidebarItem } from './waterfall_sidebar_item';
import { chartEventSelector } from '../../../../state/waterfall_chart/selectors';
import { FIXED_AXIS_HEIGHT, SIDEBAR_GROW_SIZE } from './constants';
import { IWaterfallContext } from './context/waterfall_context';
import { SideBarFlexItem, WaterfallChartSidebarWrapper } from './styles';

interface SidebarProps {
  items: Required<IWaterfallContext>['sidebarItems'];
}

export const Sidebar: React.FC<SidebarProps> = ({ items }) => {
  const { euiTheme } = useEuiTheme();
  const chartEvent = useSelector(chartEventSelector);

  return (
    <WaterfallChartSidebarWrapper grow={SIDEBAR_GROW_SIZE}>
      <div
        style={{ height: items.length * FIXED_AXIS_HEIGHT, overflow: 'hidden' }}
        data-test-subj="wfSidebarContainer"
      >
        <EuiPanel css={{ height: '100%' }} hasBorder={false} hasShadow={false} paddingSize="none">
          <EuiFlexGroup
            css={{ height: '100%', paddingTop: 1.5 }}
            direction="column"
            gutterSize="none"
            responsive={false}
          >
            {items.map((item, index) => {
              return (
                <SideBarFlexItem
                  key={index}
                  isFocused={chartEvent?.x === index}
                  css={{
                    outline: 0,
                    minWidth: 0, // Needed for flex to not stretch noWrap children
                    justifyContent: 'space-around',
                    paddingRight: euiTheme.size.s,
                  }}
                >
                  <WaterfallSidebarItem item={item} />
                </SideBarFlexItem>
              );
            })}
          </EuiFlexGroup>
        </EuiPanel>
      </div>
    </WaterfallChartSidebarWrapper>
  );
};
