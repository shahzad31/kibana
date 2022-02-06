/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useEffect, useState } from 'react';
import { useKibana } from '../../../../../src/plugins/kibana_react/public';
import { DataPublicPluginStart, TimeRange } from '../../../../../src/plugins/data/public';

export const useTimeRange = () => {
  const { data } = useKibana<{ data: DataPublicPluginStart }>().services;
  const [time, setTime] = useState<TimeRange>(() => data.query.timefilter.timefilter.getTime());

  useEffect(() => {
    setTime(data.query.timefilter.timefilter.getTime());

    const timeUpdate = data.query.timefilter.timefilter.getTimeUpdate$().subscribe((val) => {
      setTime(data.query.timefilter.timefilter.getTime());
    });
    return () => {
      timeUpdate.unsubscribe();
    };
  }, [data.query.timefilter.timefilter]);
  return time;
};
