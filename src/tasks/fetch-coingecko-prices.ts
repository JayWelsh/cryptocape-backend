import BigNumber from 'bignumber.js';
import axios from 'axios';
import { utils } from "ethers";

import {
  ICoingeckoAssetPriceEntry,
  ITokenAddressToLastPrice,
} from '../interfaces';

import {
  debugMode,
  COINGECKO_API_KEY,
} from '../constants';

import {
  sleep
} from '../utils';

const coingeckoRetryMax = 3;

export const fetchBaseAssetCoingeckoPrices = async (assetAddressesQueryString : string, retryCount: number = 0) => {
  let url = `https://pro-api.coingecko.com/api/v3/simple/price?ids=${assetAddressesQueryString}&vs_currencies=usd&x_cg_pro_api_key=${COINGECKO_API_KEY}`;
  if (debugMode) {
    console.log({url})
  }
  let results : {[key: string]: {usd: number}} = await axios.get(
    url,
    {
      headers: { "Accept-Encoding": "gzip,deflate,compress" }
    }
  )
  .then(function (response) {
    // handle success
    if(debugMode) {
      console.log(response, response?.data)
    }
    return response?.data ? response?.data : {};
  })
  .catch(async (e) => {
    retryCount++;
    if(retryCount < coingeckoRetryMax) {
      console.error(`error fetching coingecko prices at ${Math.floor(new Date().getTime() / 1000)}, retry #${retryCount}...`, e);
      await sleep(5000);
      return await fetchBaseAssetCoingeckoPrices(assetAddressesQueryString, retryCount);
    } else {
      console.error(`retries failed, error fetching coingecko prices at ${Math.floor(new Date().getTime() / 1000)}`, e);
    }
    return {};
  })
  return results;
}

export const fetchCoingeckoPrices = async (assetAddressesQueryString : string, network: string, retryCount = 0) => {
  let results : ICoingeckoAssetPriceEntry[] = await axios.get(
    `https://pro-api.coingecko.com/api/v3/simple/token_price/${network}?contract_addresses=${assetAddressesQueryString}&vs_currencies=USD&x_cg_pro_api_key=${COINGECKO_API_KEY}`,
    {
      headers: { "Accept-Encoding": "gzip,deflate,compress" }
    }
  )
  .then(function (response) {
    // handle success
    return response?.data ? response?.data : {};
  })
  .catch(async (e) => {
    retryCount++;
    if(retryCount < coingeckoRetryMax) {
      console.error(`error fetching coingecko prices at ${Math.floor(new Date().getTime() / 1000)}, retry #${retryCount}...`, e);
      await sleep(10000);
      return await fetchCoingeckoPrices(assetAddressesQueryString, network, retryCount);
    } else {
      console.error(`retries failed, error fetching coingecko prices at ${Math.floor(new Date().getTime() / 1000)}`, e);
    }
    return {};
  })
  let assetAddressToCoingeckoUsdPrice : ITokenAddressToLastPrice = {}
  let iterable = Object.entries(results);
  if(iterable.length > 0) {
    for(let assetAddressToPrice of iterable) {
      let checksumAssetAddress = utils.getAddress(assetAddressToPrice[0]);
      if(assetAddressToPrice[1].usd) {
        assetAddressToCoingeckoUsdPrice[checksumAssetAddress] = new BigNumber(assetAddressToPrice[1].usd).toString();
      } else {
        assetAddressToCoingeckoUsdPrice[checksumAssetAddress] = new BigNumber(0).toString();
      }
    }
  }
  return assetAddressToCoingeckoUsdPrice;
}