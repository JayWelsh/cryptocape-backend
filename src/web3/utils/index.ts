import { Event, utils } from 'ethers';

import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from 'ethereum-multicall';

import BigNumber from 'bignumber.js';

import {
	NetworkRepository,
} from "../../database/repositories";

import {
  INetwork
} from "../../interfaces";

import {
  sleep,
} from '../../utils';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

import {
  EthersProviderEthereum,
  // MulticallProviderEthereum,
  MulticallProviderEthereumLib2,
  EthersProviderOptimism,
  // MulticallProviderOptimism,
  MulticallProviderOptimismLib2,
  EthersProviderArbitrum,
  // MulticallProviderArbitrum,
  MulticallProviderArbitrumLib2,
} from "../../app";

export interface IEventIndexerBlockTracker {
  event_name: string
  last_checked_block: number
  genesis_block: number
  meta: string
}

export const extractFromBlockToBlock = (
  latestBlockNumber: number,
  eventIndexBlockTracker: IEventIndexerBlockTracker,
) => {
  
    const {
      last_checked_block,
      genesis_block,
    } = eventIndexBlockTracker;
  
    let toBlock = latestBlockNumber;
  
    // derive fromBlock
    let fromBlock = 0;
    if(last_checked_block) {
      fromBlock = last_checked_block
    } else if (genesis_block) { // keep else, condition is (genesis_block && !last_checked_block)
      fromBlock = genesis_block
    }

    let blockRange = toBlock - fromBlock;

    return {
      fromBlock,
      toBlock,
      blockRange
    }
    
}

export const queryFilterRetryOnFailure = async (
  contract: any,
  eventFilter: any,
  fromBlock?: number,
  toBlock?: number,
  retryCount?: number,
  retryMax?: number,
): Promise<Array<Event> | null> => {
  if(!retryMax) {
    retryMax = 10;
  }
  if(!retryCount) {
    retryCount = 0;
  }
  try {
    const eventContractEventBatch = await contract.queryFilter(eventFilter, fromBlock, toBlock);
    return eventContractEventBatch;
  } catch (e) {
    retryCount++;
    if(retryCount <= retryMax) {
      console.error(`Query failed, starting retry #${retryCount} (eventFilter: ${eventFilter}, fromBlock: ${fromBlock}, toBlock: ${toBlock})`);
      let randomDelay = 1000 + Math.floor(Math.random() * 1000);
      await sleep(randomDelay);
      return await queryFilterRetryOnFailure(contract, eventFilter, fromBlock, toBlock, retryCount, retryMax);
    } else {
      console.error(`Unable to complete queryFilter after max retries (eventFilter: ${eventFilter}, fromBlock: ${fromBlock}, toBlock: ${toBlock})`);
      return null;
    }
  }
}

// export const multicallProviderRetryOnFailure = async (
//   calls: any[],
//   network: string,
//   meta: string,
//   retryCount?: number,
//   retryMax?: number,
// ): Promise<Array<any>> => {
//   if(!retryMax) {
//     retryMax = 10;
//   }
//   if(!retryCount) {
//     retryCount = 0;
//   }
//   try {
//     if(network === 'ethereum') {
//       const [...results] = await MulticallProviderEthereum.all(calls);
//       return results;
//     } else if (network === 'optimism') {
//       const [...results] = await MulticallProviderOptimism.all(calls);
//       return results;
//     } else if (network === 'arbitrum') {
//       const [...results] = await MulticallProviderArbitrum.all(calls);
//       return results;
//     }
//     return [];
//   } catch (e) {
//     retryCount++;
//     if(retryCount <= retryMax) {
//       console.error(`Multicall failed, starting retry #${retryCount} (meta: ${meta})`);
//       let randomDelay = 1000 + Math.floor(Math.random() * 1000);
//       await sleep(randomDelay);
//       return await multicallProviderRetryOnFailure(calls, network, meta, retryCount, retryMax);
//     } else {
//       console.error(`Unable to complete multicallProviderRetryOnFailure after max retries (meta: ${meta})`);
//       return Array.from({length: calls.length});
//     }
//   }
// }

export const multicallProviderRetryOnFailureLib2 = async (
  calls: any[],
  network: string,
  meta: string,
  retryCount?: number,
  retryMax?: number,
): Promise<ContractCallResults> => {
  if(!retryMax) {
    retryMax = 10;
  }
  if(!retryCount) {
    retryCount = 0;
  }
  try {
    if(network === 'ethereum') {
      const results: ContractCallResults = await MulticallProviderEthereumLib2.call(calls);
      return results;
    } else if (network === 'optimism') {
      const results: ContractCallResults = await MulticallProviderOptimismLib2.call(calls);
      return results;
    } else if (network === 'arbitrum') {
      const results: ContractCallResults = await MulticallProviderArbitrumLib2.call(calls);
      return results;
    }
    return {results: {}, blockNumber: 0};
  } catch (e) {
    retryCount++;
    if(retryCount <= retryMax) {
      console.error(`Multicall failed, starting retry #${retryCount} (meta: ${meta})`);
      let randomDelay = 1000 + Math.floor(Math.random() * 1000);
      await sleep(randomDelay);
      return await multicallProviderRetryOnFailureLib2(calls, network, meta, retryCount, retryMax);
    } else {
      console.error(`Unable to complete multicallProviderRetryOnFailure after max retries (meta: ${meta})`, e);
      return {results: {}, blockNumber: 0};
    }
  }
}

export const getBlockWithRetries = async (blockNumber: number, retryCount?: number, retryMax?: number): Promise<any> => {
  if(!retryMax) {
    retryMax = 10;
  }
  if(!retryCount) {
    retryCount = 0;
  }
  try {
    let block = await EthersProviderEthereum.getBlock(blockNumber).catch(e => {throw new Error(e)});
    return block;
  } catch (e) {
    retryCount++;
    if(retryCount <= retryMax) {
      console.error(`Query failed, starting retry #${retryCount} (blockNumber: ${blockNumber})`);
      let randomDelay = 1000 + Math.floor(Math.random() * 1000);
      await sleep(randomDelay);
      return await getBlockWithRetries(blockNumber, retryCount, retryMax);
    } else {
      console.error(`Unable to complete getBlock after max retries (blockNumber: ${blockNumber})`);
      return null;
    }
  }
}

export const isETHAddress = (value: string) => {
  try {
      return utils.isAddress(value);
  } catch (e) {
      return false;
  }
}

export const isETHAddressArray = (value: string[]) => {
  let result = true;
  for(let entry of value) {
    try {
      if(result) {
        result = utils.isAddress(entry);
      }
    } catch (e) {
      result = false
    }
  }
  return result;
}

export const isSupportedNetwork = (network: string) => {
  let networkNames = ["ethereum", "canto", "arbitrum", "optimism"];
  if(networkNames.indexOf(network) > -1) {
    return true;
  }
  return false;
}

export const isValidBalance = (balance: string) => {
  let isNaN = new BigNumber(balance).isNaN();
  if(isNaN) {
    return false;
  }
  return true;
}