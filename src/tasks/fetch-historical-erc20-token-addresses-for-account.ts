import BigNumber from 'bignumber.js';
import axios from 'axios';
import { raw } from 'objection';
import { utils } from "ethers";

import {
  sleep
} from '../utils';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

import {
  IBalanceEntry,
  IEtherscanTxERC20,
  INetworkToBalancesERC20,
} from '../interfaces';

import {
  AccountRepository,
  AssetRepository,
  BalanceRepository,
  NetworkRepository,
} from '../database/repositories';

import {
  getBalanceOfERC20Lib2,
} from '../web3/jobs'
import e from 'express';

import {
  debugMode,
  ETHERSCAN_API_KEY,
  ARBISCAN_API_KEY,
} from '../constants';

import {
  isValidBalance
} from '../web3/utils';

import {
  parseTransactionsIntoBalancesERC20,
  getAllAccountTransactionsERC20,
} from './full-sync-account-erc20';

let pageSize = 1000;

interface ITokenAddressToBalance {
  [key: string]: IBalanceEntry
}

export const fetchHistoricalERC20TokenAddressesForAccount = async (useTimestampUnix: number, startTime: number, address: string, network: string, startBlock: string) => {

  let useTimestampPostgres = new Date(useTimestampUnix * 1000).toISOString();

  try {

    let results : ITokenAddressToBalance = {};

    if(debugMode) {
      console.log(`Full syncing ${address} on ${network}`);
    }

    // get full list of ERC-20 transactions
    let transactions = await getAllAccountTransactionsERC20(address, network, startBlock);

    if(debugMode) {
      console.log(`Fetched ${transactions.length} ERC-20 transactions on ${network}`);
    }

    let {
      parsedBalances,
      zeroBalances,
    } = await parseTransactionsIntoBalancesERC20(transactions, address, network);

    if(debugMode) {
      console.log({parsedBalances});
    }

    if(debugMode) {
      console.log(`Fetching balances for non-zero values directly from blockchain (${network})`);
    }
  
    if(debugMode) {
      console.log(`Full sync of ${address} on ${network} successful, exec time: ${new Date().getTime() - startTime}ms`)
    }

    Object.assign(results, parsedBalances);
    Object.assign(results, zeroBalances);

    return results;

  } catch (e) {
    console.log({error: e})
    console.error(`Error encountered in full sync of ${address} on ${network} at ${useTimestampPostgres}, exec time: ${new Date().getTime() - startTime}ms`)
    return null;
  }

}