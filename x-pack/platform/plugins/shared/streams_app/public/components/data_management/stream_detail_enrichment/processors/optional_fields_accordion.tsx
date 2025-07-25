/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { PropsWithChildren } from 'react';
import { EuiAccordion, useEuiTheme } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { css } from '@emotion/react';
import styled from '@emotion/styled';

const defaultButtonContent = i18n.translate(
  'xpack.streams.streamDetailView.managementTab.enrichment.processor.optionalFields',
  { defaultMessage: 'Advanced settings' }
);

const StyledEuiAccordion = styled(EuiAccordion)`
  .euiAccordion__childWrapper {
    overflow: visible;
  }
`;

export const FieldsAccordion = ({
  children,
  buttonContent,
}: PropsWithChildren<{ buttonContent?: React.ReactNode }>) => {
  const { euiTheme } = useEuiTheme();

  return (
    <StyledEuiAccordion
      element="fieldset"
      id="fieldsAccordion"
      paddingSize="none"
      buttonContent={buttonContent ?? defaultButtonContent}
    >
      <div
        css={css`
          border-left: ${euiTheme.border.thin};
          margin-left: ${euiTheme.size.m};
          padding-top: ${euiTheme.size.m};
          padding-left: calc(${euiTheme.size.m} + ${euiTheme.size.xs});
        `}
      >
        {children}
      </div>
    </StyledEuiAccordion>
  );
};
