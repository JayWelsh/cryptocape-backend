import BigNumber from 'bignumber.js';
import { utils } from "ethers";

import {
  AccountValueSnapshotRepository,
  AccountValueSnapshotHourlyRepository,
} from '../database/repositories';

import {
  ITimeseries,
} from '../interfaces';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

export const getCombinedValueBreakdownTimeseries = async (addressesArray: string[]) => {
  let timeseries : ITimeseries[] = [];
  let timestampToTimeseries : {[key: string]: ITimeseries} = {};
  let minutelyTimestamps = [];

  let accountValueSnapshotsMinutely = await AccountValueSnapshotRepository.getSnapshotHistoryByAddresses(addressesArray);

  for(let accountValueSnapshot of accountValueSnapshotsMinutely) {
    let {
      value_usd,
      timestamp,
    } = accountValueSnapshot;
    if(minutelyTimestamps.indexOf(timestamp.getTime()) === -1) {
      minutelyTimestamps.push(timestamp.getTime());
    }
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

  let accountValueSnapshotsHourly = await AccountValueSnapshotHourlyRepository.getSnapshotHistoryByAddresses(addressesArray);

  let currentTimestamp = new Date().getTime();
  let maxHourlyHistory = (60 * 60 * 24 * 30) * 1000 // 30 days
  let lowResInterval = (60 * 60 * 12) * 1000;

  for(let accountValueSnapshot of accountValueSnapshotsHourly) {
    let {
      value_usd,
      timestamp,
    } = accountValueSnapshot;
    if(minutelyTimestamps.indexOf(timestamp.getTime()) === -1) {
      if(
        ((currentTimestamp - timestamp.getTime()) <= maxHourlyHistory) 
        || (timestamp.getTime() % lowResInterval === 0)
      ) { // 12 hourly data after 30 days as per maxHourlyHistory
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