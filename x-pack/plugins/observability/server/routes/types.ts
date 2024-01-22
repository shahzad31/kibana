/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import type { EndpointOf, ReturnOf, ServerRouteRepository } from '@kbn/server-route-repository';
import {
  ElasticsearchClient,
  KibanaRequest,
  Logger,
  RequestHandlerContext,
} from '@kbn/core/server';

import { ESSearchResponse } from '@kbn/es-types';
import { estypes } from '@elastic/elasticsearch';
import { InspectResponse } from '../../typings/common';
import { ObservabilityServerRouteRepository } from './get_global_observability_server_route_repository';
import { ObservabilityRequestHandlerContext } from '../types';
import { RegisterRoutesDependencies } from './register_routes';
import { ObservabilityConfig } from '..';

export type { ObservabilityServerRouteRepository };

export interface ObservabilityRouteHandlerResources {
  context: ObservabilityRequestHandlerContext;
  dependencies: RegisterRoutesDependencies;
  logger: Logger;
  request: KibanaRequest;
  config: ObservabilityConfig;
}

export interface ObservabilityRouteCreateOptions {
  options: {
    tags: string[];
    access?: 'public' | 'internal';
  };
}

export type AbstractObservabilityServerRouteRepository = ServerRouteRepository;

export type ObservabilityAPIReturnType<
  TEndpoint extends EndpointOf<ObservabilityServerRouteRepository>
> = ReturnOf<ObservabilityServerRouteRepository, TEndpoint>;

export interface SloRequestHandlerContext extends RequestHandlerContext {
  esClient: ElasticsearchClient;
  inspectableEsQueries: InspectResponse;
  esSearch<
    DocumentSource extends unknown,
    TParams extends estypes.SearchRequest = estypes.SearchRequest
  >(
    params: TParams,
    options?: {
      operationName: string;
    }
  ): Promise<ESSearchResponse<DocumentSource, TParams>>;
}
