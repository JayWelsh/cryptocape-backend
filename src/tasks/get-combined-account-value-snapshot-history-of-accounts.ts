import BigNumber from 'bignumber.js';
import { utils } from "ethers";

import {
  AccountValueSnapshotRepository,
} from '../database/repositories';

import {
  ITimeseries,
} from '../interfaces';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

export const getCombinedValueBreakdownTimeseries = async (addressesArray: string[]) => {
  let timeseries : ITimeseries[] = [];
  let timestampToTimeseries : {[key: string]: ITimeseries} = {};

  let accountValueSnapshots = await AccountValueSnapshotRepository.getSnapshotHistoryByAddresses(addressesArray);

  for(let accountValueSnapshot of accountValueSnapshots) {
    let {
      value_usd,
      timestamp,
    } = accountValueSnapshot;
    if(new BigNumber(value_usd).isGreaterThan(1)) {
      if(timestampToTimeseries[timestamp]) {
        timestampToTimeseries[timestamp].value = new BigNumber(timestampToTimeseries[timestamp].value).plus(value_usd).toString();
      } else {
        timestampToTimeseries[timestamp] = {
          value: new BigNumber(value_usd).toString(),
          timestamp,
        };
      }
    }
  }

  for (let [timestamp, timestampToTimeseriesEntry] of Object.entries(timestampToTimeseries)) {
    timeseries.push(timestampToTimeseriesEntry);
  }

  let sortedTimeseries = timeseries.sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  })
  
  return sortedTimeseries;

}