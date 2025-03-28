/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';

import { customFieldsConfigurationMock } from '../../../containers/mock';
import { CustomFieldsList } from '.';
import { renderWithTestingProviders } from '../../../common/mock';

describe('CustomFieldsList', () => {
  let user: UserEvent;

  const props = {
    customFields: customFieldsConfigurationMock,
    onDeleteCustomField: jest.fn(),
    onEditCustomField: jest.fn(),
  };

  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    // Workaround for timeout via https://github.com/testing-library/user-event/issues/833#issuecomment-1171452841
    user = userEvent.setup({
      advanceTimers: jest.advanceTimersByTime,
    });

    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    renderWithTestingProviders(<CustomFieldsList {...props} />);

    expect(screen.getByTestId('custom-fields-list')).toBeInTheDocument();
  });

  it('shows CustomFieldsList correctly', async () => {
    renderWithTestingProviders(<CustomFieldsList {...props} />);

    expect(await screen.findByTestId('custom-fields-list')).toBeInTheDocument();

    expect(
      await screen.findByTestId(
        `custom-field-${customFieldsConfigurationMock[0].key}-${customFieldsConfigurationMock[0].type}`
      )
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Text')).length).toBe(2);
    expect((await screen.findAllByText('Required')).length).toBe(3);
    expect(
      await screen.findByTestId(
        `custom-field-${customFieldsConfigurationMock[1].key}-${customFieldsConfigurationMock[1].type}`
      )
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Toggle')).length).toBe(2);

    expect(
      await screen.findByTestId(
        `custom-field-${customFieldsConfigurationMock[4].key}-${customFieldsConfigurationMock[4].type}`
      )
    ).toBeInTheDocument();
    expect((await screen.findAllByText('Number')).length).toBe(2);
  });

  it('shows single CustomFieldsList correctly', async () => {
    renderWithTestingProviders(
      <CustomFieldsList {...{ ...props, customFields: [customFieldsConfigurationMock[0]] }} />
    );

    const list = await screen.findByTestId('custom-fields-list');

    expect(list).toBeInTheDocument();
    expect(
      await screen.findByTestId(
        `custom-field-${customFieldsConfigurationMock[0].key}-${customFieldsConfigurationMock[0].type}`
      )
    ).toBeInTheDocument();
    expect(await screen.findByText('Text')).toBeInTheDocument();
    expect(await screen.findByText('Required')).toBeInTheDocument();
    expect(
      await within(list).findByTestId(`${customFieldsConfigurationMock[0].key}-custom-field-edit`)
    ).toBeInTheDocument();
    expect(
      await within(list).findByTestId(`${customFieldsConfigurationMock[0].key}-custom-field-delete`)
    ).toBeInTheDocument();
  });

  it('does not show any panel when custom fields', () => {
    renderWithTestingProviders(<CustomFieldsList {...{ ...props, customFields: [] }} />);

    expect(screen.queryAllByTestId(`custom-field-`, { exact: false })).toHaveLength(0);
  });

  describe('Delete', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('shows confirmation modal when deleting a field ', async () => {
      renderWithTestingProviders(<CustomFieldsList {...props} />);

      const list = await screen.findByTestId('custom-fields-list');

      await user.click(
        await within(list).findByTestId(
          `${customFieldsConfigurationMock[0].key}-custom-field-delete`
        )
      );

      expect(await screen.findByTestId('confirm-delete-modal')).toBeInTheDocument();
    });

    it('calls onDeleteCustomField when confirm', async () => {
      renderWithTestingProviders(<CustomFieldsList {...props} />);

      const list = await screen.findByTestId('custom-fields-list');

      await user.click(
        await within(list).findByTestId(
          `${customFieldsConfigurationMock[0].key}-custom-field-delete`
        )
      );

      expect(await screen.findByTestId('confirm-delete-modal')).toBeInTheDocument();

      await user.click(await screen.findByText('Delete'));

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-delete-modal')).not.toBeInTheDocument();
      });

      expect(props.onDeleteCustomField).toHaveBeenCalledWith(customFieldsConfigurationMock[0].key);
    });

    it('does not call onDeleteCustomField when cancel', async () => {
      renderWithTestingProviders(<CustomFieldsList {...props} />);

      const list = await screen.findByTestId('custom-fields-list');

      await user.click(
        await within(list).findByTestId(
          `${customFieldsConfigurationMock[0].key}-custom-field-delete`
        )
      );

      expect(await screen.findByTestId('confirm-delete-modal')).toBeInTheDocument();

      await user.click(await screen.findByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('confirm-delete-modal')).not.toBeInTheDocument();
      });

      expect(props.onDeleteCustomField).not.toHaveBeenCalledWith();
    });
  });

  describe('Edit', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('calls onEditCustomField correctly', async () => {
      renderWithTestingProviders(<CustomFieldsList {...props} />);

      const list = await screen.findByTestId('custom-fields-list');

      await user.click(
        await within(list).findByTestId(`${customFieldsConfigurationMock[0].key}-custom-field-edit`)
      );

      await waitFor(() => {
        expect(props.onEditCustomField).toHaveBeenCalledWith(customFieldsConfigurationMock[0].key);
      });
    });
  });
});
