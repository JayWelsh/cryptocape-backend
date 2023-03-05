import BigNumber from 'bignumber.js';
import { utils } from "ethers";

import {
  BalanceRepository,
  BalanceShimRepository,
} from '../database/repositories';

import {
  IAccountAssetValueEntry,
} from '../interfaces';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

export const getCombinedValueBreakdownOfAccounts = async (addressesArray: string[]) => {
  let assetAddressToValue : {[key: string]: IAccountAssetValueEntry} = {};
  let total = "0";

  for (let address of addressesArray) {
    let accountBalances = await BalanceRepository.getBalanceByHolder(address);
    let accountShimBalances = await BalanceShimRepository.getBalanceShimByHolder(address);
    for(let accountBalance of [...accountBalances, ...accountShimBalances]) {
      let {
        balance,
        asset,
        asset_address,
      } = accountBalance;
      let {
        decimals,
        last_price_usd,
        market_cap_usd,
        volume_24hr_usd,
        change_24hr_usd_percent,
        symbol,
      } = asset;
      if(new BigNumber(last_price_usd).isGreaterThan(0)) {
        let valueUsd = new BigNumber(utils.formatUnits(balance, decimals)).multipliedBy(last_price_usd).toString();
        total = new BigNumber(total).plus(valueUsd).toString();
        if(new BigNumber(valueUsd).isGreaterThan(1)) {
          if(assetAddressToValue[asset_address]) {
            assetAddressToValue[asset_address].value = new BigNumber(assetAddressToValue[asset_address].value).plus(valueUsd).toString();
            assetAddressToValue[asset_address].balance = new BigNumber(assetAddressToValue[asset_address].balance).plus(balance).toString();
          } else {
            assetAddressToValue[asset_address] = {
              balance: balance.toString(),
              value: valueUsd,
              symbol: symbol,
              token_price: last_price_usd,
              percentage_of_total: "",
              market_cap_usd,
              volume_24hr_usd,
              change_24hr_usd_percent,
            };
          }
        }
      }
    }
  }

  for(let [assetAddress, valueEntry] of Object.entries(assetAddressToValue)) {
    assetAddressToValue[assetAddress].percentage_of_total = new BigNumber(valueEntry.value).multipliedBy(100).dividedBy(total).toString();
  }
  
  return {
    total,
    assetAddressToValue,
  }

}