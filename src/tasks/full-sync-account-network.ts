import BigNumber from 'bignumber.js';

import { fullSyncAccountBalancesERC20 } from './full-sync-account-erc20';
import { syncAccountBalanceBaseAsset } from './sync-account-base-asset';

import {
	SyncTrackRepository,
} from "../database/repositories";

import {
	IAddressToMultichainBaseBalance,
	ITokenAddressList,
	IAddressToNetworkToLatestBlock,
	IAddressToMultichainBalances,
} from '../interfaces';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

export const runAccountFullNetworkSync = async (
	network: string,
	address: string,
	postgresTimestamp: number,
	tokenAddressList?: ITokenAddressList,
	addressToMultichainBalances?: IAddressToMultichainBalances,
	addressToNetworkToLatestBlock?: IAddressToNetworkToLatestBlock,
	addressToMultichainBaseBalance?: IAddressToMultichainBaseBalance,
) => {

	let latestSyncRecord = await SyncTrackRepository.getSyncTrack(address, network, 'erc20-sync');
	let startBlock = latestSyncRecord?.latest_block_synced ? latestSyncRecord?.latest_block_synced : "0";

	let [baseAssetBalance, balances] = await Promise.all([
		syncAccountBalanceBaseAsset(postgresTimestamp, new Date().getTime(), address, network),
		fullSyncAccountBalancesERC20(postgresTimestamp, new Date().getTime(), address, network, startBlock),
	]);

  if(addressToMultichainBaseBalance) {
    if(addressToMultichainBaseBalance[address]) {
      addressToMultichainBaseBalance[address][network] = baseAssetBalance;
    } else {
      addressToMultichainBaseBalance[address] = {};
      addressToMultichainBaseBalance[address][network] = baseAssetBalance;
    }
  }

	if(balances){
		for(let [key, balanceEntry] of Object.entries(balances)) {
			if(network)
      if(tokenAddressList) {
        if(!tokenAddressList[network]) {
          tokenAddressList[network] = [key];
        } else {
          tokenAddressList[network].push(key);
        }
      }
      if(addressToNetworkToLatestBlock) {
        if(!addressToNetworkToLatestBlock[address]) {
          addressToNetworkToLatestBlock[address] = {};
        }
        if(!addressToNetworkToLatestBlock[address][network] || new BigNumber(balanceEntry.latestBlock).isGreaterThan(addressToNetworkToLatestBlock[address][network])) {
          addressToNetworkToLatestBlock[address][network] = balanceEntry.latestBlock;
        }
      }
		}
    if(addressToMultichainBalances) {
      if(addressToMultichainBalances[address]) {
        addressToMultichainBalances[address][network] = balances;
      } else {
        addressToMultichainBalances[address] = {};
        addressToMultichainBalances[address][network] = balances;
      }
    }
	}
}