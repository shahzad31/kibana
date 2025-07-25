/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */
import { i18n } from '@kbn/i18n';
import { TRIGGER_SUGGESTION_COMMAND } from '../../commands_registry/constants';
import { ISuggestionItem } from '../../commands_registry/types';

export const buildValueDefinitions = (
  values: string[],
  options?: { advanceCursorAndOpenSuggestions?: boolean; addComma?: boolean }
): ISuggestionItem[] =>
  values.map((value) => ({
    label: `"${value}"`,
    text: `"${value}"${options?.addComma ? ',' : ''}${
      options?.advanceCursorAndOpenSuggestions ? ' ' : ''
    }`,
    detail: i18n.translate('kbn-esql-ast.esql.autocomplete.valueDefinition', {
      defaultMessage: 'Literal value',
    }),
    kind: 'Value',
    command: options?.advanceCursorAndOpenSuggestions ? TRIGGER_SUGGESTION_COMMAND : undefined,
  }));
