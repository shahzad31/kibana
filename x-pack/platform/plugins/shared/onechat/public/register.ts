/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { CoreSetup } from '@kbn/core-lifecycle-browser';
import { DEFAULT_APP_CATEGORIES } from '@kbn/core-application-common';
import { AppMountParameters } from '@kbn/core-application-browser';
import { i18n } from '@kbn/i18n';
import { OnechatInternalService } from './services';
import { OnechatPluginStart } from './types';
import { ONECHAT_APP_ID, ONECHAT_PATH, ONECHAT_TITLE } from '../common/features';

export const registerApp = ({
  core,
  getServices,
}: {
  core: CoreSetup<OnechatPluginStart>;
  getServices: () => OnechatInternalService;
}) => {
  core.application.register({
    id: ONECHAT_APP_ID,
    appRoute: ONECHAT_PATH,
    category: DEFAULT_APP_CATEGORIES.enterpriseSearch,
    title: ONECHAT_TITLE,
    euiIconType: 'logoElasticsearch',
    visibleIn: ['sideNav', 'globalSearch'],
    deepLinks: [
      {
        id: 'conversations',
        path: '/conversations',
        title: i18n.translate('xpack.onechat.chat.conversationsTitle', {
          defaultMessage: 'Conversations',
        }),
      },
      {
        id: 'tools',
        path: '/tools',
        title: i18n.translate('xpack.onechat.tools.title', { defaultMessage: 'Tools' }),
      },
      {
        id: 'agents',
        path: '/agents',
        title: i18n.translate('xpack.onechat.agents.title', { defaultMessage: 'Agents' }),
      },
    ],
    async mount({ element, history }: AppMountParameters) {
      const { mountApp } = await import('./application');
      const [coreStart, startPluginDeps] = await core.getStartServices();

      coreStart.chrome.docTitle.change(ONECHAT_TITLE);
      const services = getServices();

      return mountApp({ core: coreStart, services, element, history, plugins: startPluginDeps });
    },
  });
};
