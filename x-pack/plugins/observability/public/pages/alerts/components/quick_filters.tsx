/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';
import React, { useEffect, useState } from 'react';
import { AwaitingControlGroupAPI, ControlGroupRenderer } from '@kbn/controls-plugin/public';
import { ViewMode } from '@kbn/embeddable-plugin/common';
import styled from 'styled-components';
import { DataView } from '@kbn/data-views-plugin/common';

interface Props {
  dataViews?: DataView[];
}

export function QuickFilters({ dataViews }: Props) {
  const [controlGroupAPI, setControlGroupAPI] = useState<AwaitingControlGroupAPI>();

  useEffect(() => {
    if (!controlGroupAPI) {
      return;
    }
    const subscription = controlGroupAPI.onFiltersPublished$.subscribe((newFilters) => {});
    return () => {
      subscription.unsubscribe();
    };
  }, [controlGroupAPI]);

  if (!dataViews || dataViews.length === 0) {
    return null;
  }

  return (
    <Container>
      <ControlGroupRenderer
        getCreationOptions={async (initialInput, builder) => {
          await builder.addOptionsListControl(initialInput, {
            dataViewId: dataViews[0]?.id!,
            fieldName: 'kibana.alert.status',
            width: 'small',
            grow: true,
            title: STATUS_LABEL,
            controlId: 'alert-status-filter',
            // exclude: statusFilter?.meta.negate,
            // selectedOptions: getSelectedOptions(statusFilter),
            // existsSelected: Boolean(statusFilter?.query?.exists.field === 'status'),
            hideExists: true,
          });
          await builder.addOptionsListControl(initialInput, {
            dataViewId: dataViews[0]?.id!,
            title: TAGS_LABEL,
            fieldName: 'kibana.alert.rule.category',
            width: 'small',
            grow: false,
            controlId: 'alert-category-filter',
            // selectedOptions: getSelectedOptions(tagsFilter),
            // exclude: statusFilter?.meta.negate,
            // existsSelected: Boolean(tagsFilter?.query?.exists.field === 'slo.tags'),
            hideExists: true,
          });
          return {
            initialInput: {
              ...initialInput,
              viewMode: ViewMode.VIEW,
            },
          };
        }}
        ref={setControlGroupAPI}
        timeRange={{ from: 'now-24h', to: 'now' }}
      />
    </Container>
  );
}

const Container = styled.div`
  .controlGroup {
    min-height: initial;
  }
`;

const TAGS_LABEL = i18n.translate('xpack.observability.slo.list.tags', {
  defaultMessage: 'Tags',
});

const STATUS_LABEL = i18n.translate('xpack.observability.slo.list.status', {
  defaultMessage: 'Status',
});
