/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { httpServerMock } from '@kbn/core/server/mocks';
import { CAPABILITIES } from '../../common/constants';
import type {
  CreateAttackDiscoverySchedulesRequestBody,
  DefendInsightsGetRequestQuery,
  DefendInsightsPostRequestBody,
  DeleteKnowledgeBaseEntryRequestParams,
  KnowledgeBaseEntryUpdateProps,
  UpdateAttackDiscoverySchedulesRequestBody,
  UpdateKnowledgeBaseEntryRequestParams,
} from '@kbn/elastic-assistant-common';
import {
  ATTACK_DISCOVERY,
  ATTACK_DISCOVERY_BY_CONNECTOR_ID,
  ATTACK_DISCOVERY_CANCEL_BY_CONNECTOR_ID,
  ATTACK_DISCOVERY_SCHEDULES,
  ATTACK_DISCOVERY_SCHEDULES_BY_ID,
  ATTACK_DISCOVERY_SCHEDULES_BY_ID_DISABLE,
  ATTACK_DISCOVERY_SCHEDULES_BY_ID_ENABLE,
  ATTACK_DISCOVERY_SCHEDULES_FIND,
  AttackDiscoveryPostRequestBody,
  ConversationCreateProps,
  ConversationUpdateProps,
  DEFEND_INSIGHTS,
  DEFEND_INSIGHTS_BY_ID,
  ELASTIC_AI_ASSISTANT_ALERT_SUMMARY_URL_BULK_ACTION,
  ELASTIC_AI_ASSISTANT_ALERT_SUMMARY_URL_FIND,
  ELASTIC_AI_ASSISTANT_ANONYMIZATION_FIELDS_URL_BULK_ACTION,
  ELASTIC_AI_ASSISTANT_ANONYMIZATION_FIELDS_URL_FIND,
  ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL,
  ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BULK_ACTION,
  ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BY_ID,
  ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BY_ID_MESSAGES,
  ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_FIND,
  ELASTIC_AI_ASSISTANT_EVALUATE_URL,
  ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL,
  ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL_BULK_ACTION,
  ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL_BY_ID,
  ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL_FIND,
  ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_INDICES_URL,
  ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_URL,
  ELASTIC_AI_ASSISTANT_PROMPTS_URL_BULK_ACTION,
  ELASTIC_AI_ASSISTANT_PROMPTS_URL_FIND,
  PerformKnowledgeBaseEntryBulkActionRequestBody,
  PostEvaluateRequestBodyInput,
  ELASTIC_AI_ASSISTANT_SECURITY_AI_PROMPTS_URL_FIND,
} from '@kbn/elastic-assistant-common';
import {
  getAppendConversationMessagesSchemaMock,
  getCreateConversationSchemaMock,
  getDeleteAllConversationsSchemaMock,
  getUpdateConversationSchemaMock,
} from './conversations_schema.mock';
import { getCreateKnowledgeBaseEntrySchemaMock } from './knowledge_base_entry_schema.mock';
import {
  AnonymizationFieldCreateProps,
  AnonymizationFieldUpdateProps,
  AlertSummaryCreateProps,
  AlertSummaryUpdateProps,
  PromptCreateProps,
  PromptUpdateProps,
} from '@kbn/elastic-assistant-common/impl/schemas';

export const requestMock = {
  create: httpServerMock.createKibanaRequest,
};

export const getGetKnowledgeBaseIndicesRequest = () =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_INDICES_URL,
  });

export const getGetKnowledgeBaseStatusRequest = (resource?: string) =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_URL,
    query: { resource },
  });

export const getPostKnowledgeBaseRequest = (resource?: string) =>
  requestMock.create({
    method: 'post',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_URL,
    query: { resource },
  });

export const getCreateKnowledgeBaseEntryRequest = () =>
  requestMock.create({
    method: 'post',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL,
    body: getCreateKnowledgeBaseEntrySchemaMock(),
  });

export const getBulkActionKnowledgeBaseEntryRequest = (
  body: PerformKnowledgeBaseEntryBulkActionRequestBody
) =>
  requestMock.create({
    method: 'post',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL_BULK_ACTION,
    body,
  });

export const getUpdateKnowledgeBaseEntryRequest = ({
  params,
  body,
}: {
  params: UpdateKnowledgeBaseEntryRequestParams;
  body: KnowledgeBaseEntryUpdateProps;
}) =>
  requestMock.create({
    method: 'put',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL_BY_ID,
    params,
    body,
  });

export const getDeleteKnowledgeBaseEntryRequest = (params: DeleteKnowledgeBaseEntryRequestParams) =>
  requestMock.create({
    method: 'delete',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL_BY_ID,
    params,
  });

export const getGetCapabilitiesRequest = () =>
  requestMock.create({
    method: 'get',
    path: CAPABILITIES,
  });

export const getPostEvaluateRequest = ({ body }: { body: PostEvaluateRequestBodyInput }) =>
  requestMock.create({
    body,
    method: 'post',
    path: ELASTIC_AI_ASSISTANT_EVALUATE_URL,
  });

export const getKnowledgeBaseEntryGetRequest = (
  id: string = '04128c15-0d1b-4716-a4c5-46997ac7f3bd'
) =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL_BY_ID,
    params: { id },
  });

export const getKnowledgeBaseEntryFindRequest = () =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_KNOWLEDGE_BASE_ENTRIES_URL_FIND,
  });

export const getCurrentUserFindRequest = () =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_FIND,
  });

export const getCurrentUserPromptsRequest = () =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_PROMPTS_URL_FIND,
  });

export const getCurrentUserSecurityAIPromptsRequest = () =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_SECURITY_AI_PROMPTS_URL_FIND,
    query: { prompt_group_id: 'aiAssistant', prompt_ids: ['systemPrompt'] },
  });

export const getCurrentUserAlertSummaryRequest = () =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_ALERT_SUMMARY_URL_FIND,
    query: { connector_id: '123' },
  });

export const getCurrentUserAnonymizationFieldsRequest = () =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_ANONYMIZATION_FIELDS_URL_FIND,
  });

export const getDeleteConversationRequest = (id: string = '04128c15-0d1b-4716-a4c5-46997ac7f3bd') =>
  requestMock.create({
    method: 'delete',
    path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BY_ID,
    params: { id },
  });

export const getDeleteAllConversationsRequest = () =>
  requestMock.create({
    method: 'delete',
    path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL,
    body: getDeleteAllConversationsSchemaMock(),
  });

export const getCreateConversationRequest = () =>
  requestMock.create({
    method: 'post',
    path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL,
    body: getCreateConversationSchemaMock(),
  });

export const getUpdateConversationRequest = (id: string = '04128c15-0d1b-4716-a4c5-46997ac7f3bd') =>
  requestMock.create({
    method: 'put',
    path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BY_ID,
    body: getUpdateConversationSchemaMock(),
    params: { id },
  });

export const getAppendConversationMessageRequest = (
  id: string = '04128c15-0d1b-4716-a4c5-46997ac7f3bd'
) =>
  requestMock.create({
    method: 'post',
    path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BY_ID_MESSAGES,
    body: getAppendConversationMessagesSchemaMock(),
    params: { id },
  });

export const getConversationReadRequest = (id: string = '04128c15-0d1b-4716-a4c5-46997ac7f3bd') =>
  requestMock.create({
    method: 'get',
    path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BY_ID,
    params: { id },
  });

export const getConversationsBulkActionRequest = (
  create: ConversationCreateProps[] = [],
  update: ConversationUpdateProps[] = [],
  deleteIds: string[] = []
) =>
  requestMock.create({
    method: 'patch',
    path: ELASTIC_AI_ASSISTANT_CONVERSATIONS_URL_BULK_ACTION,
    body: {
      create,
      update,
      delete: {
        ids: deleteIds,
      },
    },
  });

export const getPromptsBulkActionRequest = (
  create: PromptCreateProps[] = [],
  update: PromptUpdateProps[] = [],
  deleteIds: string[] = []
) =>
  requestMock.create({
    method: 'patch',
    path: ELASTIC_AI_ASSISTANT_PROMPTS_URL_BULK_ACTION,
    body: {
      create,
      update,
      delete: {
        ids: deleteIds,
      },
    },
  });

export const getAnonymizationFieldsBulkActionRequest = (
  create: AnonymizationFieldCreateProps[] = [],
  update: AnonymizationFieldUpdateProps[] = [],
  deleteIds: string[] = []
) =>
  requestMock.create({
    method: 'patch',
    path: ELASTIC_AI_ASSISTANT_ANONYMIZATION_FIELDS_URL_BULK_ACTION,
    body: {
      create,
      update,
      delete: {
        ids: deleteIds,
      },
    },
  });

export const getAlertSummaryBulkActionRequest = (
  create: AlertSummaryCreateProps[] = [],
  update: AlertSummaryUpdateProps[] = [],
  deleteIds: string[] = []
) =>
  requestMock.create({
    method: 'patch',
    path: ELASTIC_AI_ASSISTANT_ALERT_SUMMARY_URL_BULK_ACTION,
    body: {
      create,
      update,
      delete: {
        ids: deleteIds,
      },
    },
  });

export const getCancelAttackDiscoveryRequest = (connectorId: string) =>
  requestMock.create({
    method: 'put',
    path: ATTACK_DISCOVERY_CANCEL_BY_CONNECTOR_ID,
    params: { connectorId },
  });

export const getAttackDiscoveryRequest = (connectorId: string) =>
  requestMock.create({
    method: 'get',
    path: ATTACK_DISCOVERY_BY_CONNECTOR_ID,
    params: { connectorId },
  });

export const postAttackDiscoveryRequest = (body: AttackDiscoveryPostRequestBody) =>
  requestMock.create({
    method: 'post',
    path: ATTACK_DISCOVERY,
    body,
  });

export const getDefendInsightRequest = (insightId: string) =>
  requestMock.create({
    method: 'get',
    path: DEFEND_INSIGHTS_BY_ID,
    params: { id: insightId },
  });

export const getDefendInsightsRequest = (queryParams: DefendInsightsGetRequestQuery) =>
  requestMock.create({
    method: 'get',
    path: DEFEND_INSIGHTS,
    query: queryParams,
  });

export const postDefendInsightsRequest = (body: DefendInsightsPostRequestBody) =>
  requestMock.create({
    method: 'post',
    path: DEFEND_INSIGHTS,
    body,
  });

export const findAttackDiscoverySchedulesRequest = () =>
  requestMock.create({
    method: 'get',
    path: ATTACK_DISCOVERY_SCHEDULES_FIND,
  });

export const createAttackDiscoverySchedulesRequest = (
  body: CreateAttackDiscoverySchedulesRequestBody
) =>
  requestMock.create({
    method: 'post',
    path: ATTACK_DISCOVERY_SCHEDULES,
    body,
  });

export const deleteAttackDiscoverySchedulesRequest = (id: string) =>
  requestMock.create({
    method: 'delete',
    path: ATTACK_DISCOVERY_SCHEDULES_BY_ID,
    params: { id },
  });

export const getAttackDiscoverySchedulesRequest = (id: string) =>
  requestMock.create({
    method: 'get',
    path: ATTACK_DISCOVERY_SCHEDULES_BY_ID,
    params: { id },
  });

export const updateAttackDiscoverySchedulesRequest = (
  id: string,
  body: UpdateAttackDiscoverySchedulesRequestBody
) =>
  requestMock.create({
    method: 'put',
    path: ATTACK_DISCOVERY_SCHEDULES_BY_ID,
    params: { id },
    body,
  });

export const enableAttackDiscoverySchedulesRequest = (id: string) =>
  requestMock.create({
    method: 'post',
    path: ATTACK_DISCOVERY_SCHEDULES_BY_ID_ENABLE,
    params: { id },
  });

export const disableAttackDiscoverySchedulesRequest = (id: string) =>
  requestMock.create({
    method: 'put',
    path: ATTACK_DISCOVERY_SCHEDULES_BY_ID_DISABLE,
    params: { id },
  });
