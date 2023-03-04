import BigNumber from 'bignumber.js';
import axios from 'axios';
import { raw } from 'objection';
import { utils } from "ethers";

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
  debugMode
} from '../constants';

import {
  isValidBalance
} from '../web3/utils';

let pageSize = 1000;

interface ITokenAddressToBalance {
  [key: string]: IBalanceEntry
}

const getAllAccountTransactionsERC20 = async (
  account: string,
  network: string,
  startBlock: string = "0",
  page: number = 1,
  offset: number = pageSize,
  results: IEtherscanTxERC20[] = [],
) => {
  let url;
  if(network === 'ethereum') {
    url = `https://api.etherscan.io/api?module=account&action=tokentx&address=${account}&page=${page}&sort=asc&offset=${offset}&startblock=${startBlock}&apikey=4H7XW7VUYZD2A63GPIJ4YWEMIMTU6M9PGE`;
  }
  if(network === 'optimism') {
    url = `https://api-optimistic.etherscan.io/api?module=account&action=tokentx&address=${account}&page=${page}&sort=asc&startblock=${startBlock}&offset=${offset}`;
  }
  if(network === 'arbitrum') {
    url = `https://api.arbiscan.io/api?module=account&action=tokentx&address=${account}&page=${page}&sort=asc&startblock=${startBlock}&offset=${offset}`;
  }
  if(url) {
    if(debugMode) {
      console.log(`Fetching page ${page} of ${account} ERC-20 txs on ${network}`);
      console.log(`Using URL: ${url}`);
    }
    let response = await axios.get(
      url,
      {
        headers: { "Accept-Encoding": "gzip,deflate,compress" }
      }
    );
    let message = response?.data?.message;
    let data = response?.data?.result;
    let additionalResults: IEtherscanTxERC20[] = [];
    if(data.length > 0) {
      if(data.length === pageSize) {
        additionalResults = await getAllAccountTransactionsERC20(account, network, startBlock, page + 1, pageSize, results);
      }
    }
    return [...data, ...additionalResults];
  } else {
    return [];
  }
}

const parseTransactionsIntoBalancesERC20 = async (transactions: IEtherscanTxERC20[], account: string, network: string) => {
 
  let tokenAddressToBalance : ITokenAddressToBalance = {};

  for(let transaction of transactions) {

    let {
      contractAddress,
      tokenSymbol,
      tokenName,
      tokenDecimal,
      value,
      to,
      from,
      blockNumber,
    } = transaction;

    contractAddress = utils.getAddress(contractAddress);
    to = utils.getAddress(to);
    from = utils.getAddress(from);

    // for debugging
    // if(to === account) {
    //   console.log(`Receiving ${value} from ${to}`)
    // } else if(from === account) {
    //   console.log(`Sending ${value} to ${to}`)
    // } else {
    //   console.log("unsure", from, to, account, transaction);
    // }

    if(!tokenAddressToBalance[contractAddress]) {
      tokenAddressToBalance[contractAddress] = {
        balance: "0",
        latestBlock: blockNumber,
        tokenInfo: {
          address: contractAddress,
          symbol: tokenSymbol,
          name: tokenName,
          decimal: tokenDecimal,
          standard: "ERC-20",
          network: network,
        }
      };
    } else if(new BigNumber(blockNumber).isGreaterThan(tokenAddressToBalance[contractAddress].latestBlock)) {
      tokenAddressToBalance[contractAddress].latestBlock = blockNumber;
    }

    if(to === from) {
      // is tx to self, do nothing
    } else if(to === account) {
      // is receive (add to balance)
      tokenAddressToBalance[contractAddress].balance = new BigNumber(tokenAddressToBalance[contractAddress].balance).plus(value).toString();
    } if(from === account) {
      // is sent (subtract from balance)
      tokenAddressToBalance[contractAddress].balance = new BigNumber(tokenAddressToBalance[contractAddress].balance).minus(value).toString();
    }

    // Remove zero values
    if(tokenAddressToBalance[contractAddress].balance === "0") {
      delete tokenAddressToBalance[contractAddress];
    }

  }

  return tokenAddressToBalance;

}

const getOnchainBalancesFromParsedBalances = async (parsedBalances: ITokenAddressToBalance, holder: string, network: string) => {

  let assetAddresses = Object.entries(parsedBalances).map(([key]) => key);

  if(assetAddresses?.length > 0) {

    let onchainBalances = await getBalanceOfERC20Lib2(assetAddresses, holder, network);

    if(debugMode) {
      console.log({onchainBalances})
    }

    return onchainBalances;

  } else {

    return {}

  }

}

export const fullSyncAccountBalancesERC20 = async (useTimestampUnix: number, startTime: number, address: string, network: string, startBlock: string) => {

  let useTimestampPostgres = new Date(useTimestampUnix * 1000).toISOString();

  try {

    // let latestBlockNumber = await getLatestBlockNumber();

    if(debugMode) {
      console.log(`Full syncing ${address} on ${network}`);
    }

    // get full list of ERC-20 transactions
    let transactions = await getAllAccountTransactionsERC20(address, network, startBlock);

    if(debugMode) {
      console.log(`Fetched ${transactions.length} ERC-20 transactions on ${network}`);
    }

    let parsedBalances = await parseTransactionsIntoBalancesERC20(transactions, address, network);

    if(debugMode) {
      console.log({parsedBalances});
    }

    if(debugMode) {
      console.log(`Fetching balances for non-zero values directly from blockchain (${network})`);
    }

    let onchainBalances = await getOnchainBalancesFromParsedBalances(parsedBalances, address, network);

    for(let [tokenAddress, parsedBalanceEntry] of Object.entries(parsedBalances)) {
      // Check if asset record exists for this asset
      let existingAssetRecord = await AssetRepository.findByColumn("address", tokenAddress);
      if(!existingAssetRecord) {
        await AssetRepository.create({
          address: tokenAddress,
          network_name: network,
          name: parsedBalanceEntry.tokenInfo.name,
          symbol: parsedBalanceEntry.tokenInfo.symbol,
          standard: parsedBalanceEntry.tokenInfo.standard,
          decimals: parsedBalanceEntry.tokenInfo.decimal,
        });
      }
      // Check if balance record exists for this address
      let existingBalanceRecord = await BalanceRepository.getBalanceByAssetAndHolder(tokenAddress, address);
      if(onchainBalances[tokenAddress] && isValidBalance(onchainBalances[tokenAddress])) {
        parsedBalances[tokenAddress].balance = onchainBalances[tokenAddress];
        if(!existingBalanceRecord) {
          // Create balance record
          await BalanceRepository.create({
            network_name: network,
            asset_address: tokenAddress,
            holder_address: address,
            balance: onchainBalances[tokenAddress],
          })
        } else {
          // Update balance record
          await BalanceRepository.update({
            balance: onchainBalances[tokenAddress],
          }, existingBalanceRecord.id);
        }
      }
    }

    if(debugMode) {
      console.log({onchainBalances, network})
    }
  
    if(debugMode) {
      console.log(`Full sync of ${address} on ${network} successful, exec time: ${new Date().getTime() - startTime}ms`)
    }

    return parsedBalances;

  } catch (e) {
    console.log({error: e})
    console.error(`Error encountered in full sync of ${address} on ${network} at ${useTimestampPostgres}, exec time: ${new Date().getTime() - startTime}ms`)
    return null;
  }

}