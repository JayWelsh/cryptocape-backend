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

  for (let address of addressesArray) {
    let accountValueSnapshots = await AccountValueSnapshotRepository.getSnapshotHistory(address);

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
  }

  for (let [timestamp, timestampToTimeseriesEntry] of Object.entries(timestampToTimeseries)) {
    timeseries.push(timestampToTimeseriesEntry);
  }

  // for(let [assetAddress, valueEntry] of Object.entries(assetAddressToValue)) {
  //   assetAddressToValue[assetAddress].percentage_of_total = new BigNumber(valueEntry.value).multipliedBy(100).dividedBy(total).toString();
  // }
  
  return timeseries;

}