/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useState } from 'react';
import { EuiConfirmModal, useGeneratedHtmlId } from '@elastic/eui';
import { i18n } from '@kbn/i18n';
import { useDeleteSynonymRule } from '../../hooks/use_delete_synonym_rule';
import { useUsageTracker } from '../../hooks/use_usage_tracker';
import { AnalyticsEvents } from '../../analytics/constants';

export interface DeleteSynonymRuleModalProps {
  synonymsSetId: string;
  ruleId: string;
  closeDeleteModal: () => void;
}

export const DeleteSynonymRuleModal = ({
  closeDeleteModal,
  ruleId,
  synonymsSetId,
}: DeleteSynonymRuleModalProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const modalTitleId = useGeneratedHtmlId();

  const onSuccess = () => {
    setIsLoading(false);
    closeDeleteModal();
  };

  const onError = () => {
    setIsLoading(false);
    closeDeleteModal();
  };

  const { mutate: deleteEndpoint } = useDeleteSynonymRule(onSuccess, onError);
  const usageTracker = useUsageTracker();

  const deleteOperation = () => {
    setIsLoading(true);
    usageTracker?.click(AnalyticsEvents.rule_deleted);
    deleteEndpoint({ synonymsSetId, ruleId });
  };

  return (
    <EuiConfirmModal
      aria-labelledby={modalTitleId}
      title={i18n.translate('xpack.searchSynonyms.deleteSynonymRuleModal.title', {
        defaultMessage: 'Delete synonym rule',
      })}
      titleProps={{ id: modalTitleId }}
      onCancel={closeDeleteModal}
      onConfirm={deleteOperation}
      cancelButtonText={i18n.translate('xpack.searchSynonyms.deleteSynonymRuleModal.cancelButton', {
        defaultMessage: 'Cancel',
      })}
      confirmButtonText={i18n.translate(
        'xpack.searchSynonyms.deleteSynonymRuleModal.confirmButton',
        {
          defaultMessage: 'Delete',
        }
      )}
      buttonColor="danger"
      isLoading={isLoading}
    >
      <p>
        {i18n.translate('xpack.searchSynonyms.deleteSynonymRuleModal.body', {
          defaultMessage: 'Are you sure you want to delete the synonym rule {ruleId}?',
          values: { ruleId },
        })}
      </p>
    </EuiConfirmModal>
  );
};
