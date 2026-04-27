/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

export const getTestRunDetailRelativeLink = ({
  monitorId,
  checkGroup,
  locationId,
  spaceId,
}: {
  monitorId: string;
  checkGroup: string;
  locationId?: string;
  spaceId?: string;
}) => {
  const spaceIdQuery = spaceId ? `&spaceId=${spaceId}` : '';
  return `/monitor/${monitorId}/test-run/${checkGroup}?locationId=${locationId}${spaceIdQuery}`;
};

export const getTestRunDetailLink = ({
  monitorId,
  basePath,
  checkGroup,
  locationId,
  spaceId,
}: {
  monitorId: string;
  checkGroup: string;
  basePath: string;
  locationId?: string;
  spaceId?: string;
}) => {
  return `${basePath}/app/synthetics${getTestRunDetailRelativeLink({
    monitorId,
    checkGroup,
    locationId,
    spaceId,
  })}`;
};
