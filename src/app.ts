import express from "express";
import { Provider } from 'ethers-multicall';
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { Model } from "objection";
import Knex from "knex";
import {CronJob} from "cron";
import { providers, utils} from "ethers";
import BigNumber from 'bignumber.js';

// switch to https://www.npmjs.com/package/myethereum-multicall2.0/v/2.4.5 for multicalls

import {
  ALCHEMY_API_KEY_ETHEREUM,
	ALCHEMY_API_KEY_OPTIMISM,
	ALCHEMY_API_KEY_ARBITRUM,
	networkToCoingeckoId,
	networkToBaseAssetId,
	debugMode,
} from "./constants"

import routes from "./routes";
import dbConfig from "./config/database";

import {
	AccountRepository,
	SyncTrackRepository,
} from "./database/repositories";

import { fullSyncAccountBalancesERC20 } from './tasks/full-sync-account-erc20';
import { syncAccountBalanceBaseAsset } from './tasks/sync-account-base-asset';
import {
	fetchCoingeckoPrices,
	fetchBaseAssetCoingeckoPrices,
} from './tasks/fetch-coingecko-prices';
import { IBalanceEntry } from "./interfaces";
import { sleep } from "./utils";

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

// minutely cycle to run indexer, 10 = 10 minutes (i.e. 10, 20, 30, 40, 50, 60 past the hour).
// recommend to use 10 if doing a full sync, once up to speed, 2 minutes should be safe.
let contractEventIndexerPeriodMinutes = 2;

let corsOptions = {
  origin: ['http://localhost:3000'],
}

dotenv.config();

// DB
const knex = Knex(dbConfig);
Model.knex(knex);

const app = express();
const port = process.env.PORT || 8000;

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

routes(app);

app.listen(port);

console.log(`----- ⚡ SERVER LISTENING ⚡ -----`);
console.log(`-------- ⚡ PORT: ${port} ⚡ --------`);

const runFullSync = async (useTimestampUnix: number, startTime: number) => {
	let accounts = await AccountRepository.getAccounts();

	let postgresTimestamp = Math.floor(new Date().setSeconds(0) / 1000);

	let tempUSD = "0";
	let addressToNetworkToLatestBlock : {[key: string]: {[key: string]: string}} = {};
	let tokenAddressToNameToUsd : {[key: string]: {[key: string]: string}} = {} = {};
	let tokenAddressList: {[key: string]: string[]} = {};
	let networkToCoingeckoPrices : {[key: string]: {[key: string]: string}} = {};
	let addressToMultichainBalances : {[key: string]: {[key: string]: {[key: string]: IBalanceEntry}}} = {};
	let addressToMultichainBaseBalance : {[key: string]: {[key: string]: string}} = {};

	for(let account of accounts) {

		let {
			address,
			mainnet_enabled,
			optimism_enabled,
			arbitrum_enabled,
			canto_enabled,
		} = account;

		address = utils.getAddress(address);

		let networks = [];

		if(mainnet_enabled) {
			networks.push("mainnet");
		}
		if(optimism_enabled) {
			networks.push("optimism");
		}
		if(arbitrum_enabled) {
			networks.push("arbitrum");
		}
		if(canto_enabled) {
			networks.push("canto");
		}
		
		for(let network of networks) {
			let latestSyncRecord = await SyncTrackRepository.getSyncTrack(address, network, 'erc20-sync');
			let startBlock = latestSyncRecord?.latest_block_synced ? latestSyncRecord?.latest_block_synced : "0";

			let baseAssetBalance = await syncAccountBalanceBaseAsset(postgresTimestamp, new Date().getTime(), address, network);
			if(addressToMultichainBaseBalance[address]) {
				addressToMultichainBaseBalance[address][network] = baseAssetBalance;
			} else {
				addressToMultichainBaseBalance[address] = {};
				addressToMultichainBaseBalance[address][network] = baseAssetBalance;
			}

			let balances = await fullSyncAccountBalancesERC20(postgresTimestamp, new Date().getTime(), address, network, startBlock);
			// TEMP SHIM
			if(network === "mainnet" && address === "0xE8256119A8621a6Ba3c42e807B261840bDe77944") {
				if(balances) {
					balances["0x226bb599a12C826476e3A771454697EA52E9E220"] = {
						balance: '5499775648690',
						latestBlock: startBlock,
						tokenInfo: {
							name: "Propy",
							symbol: "PRO",
							address: "0x226bb599a12C826476e3A771454697EA52E9E220",
							decimal: '8',
							standard: 'ERC-20',
							network: 'mainnet',
						}
					}
				}
			}
			if(balances){
				for(let [key, balanceEntry] of Object.entries(balances)) {
					if(network)
					if(!tokenAddressList[network]) {
						tokenAddressList[network] = [key];
					} else {
						tokenAddressList[network].push(key);
					}
					if(!addressToNetworkToLatestBlock[address]) {
						addressToNetworkToLatestBlock[address] = {};
					}
					if(!addressToNetworkToLatestBlock[address][network] || new BigNumber(balanceEntry.latestBlock).isGreaterThan(addressToNetworkToLatestBlock[address][network])) {
						addressToNetworkToLatestBlock[address][network] = balanceEntry.latestBlock;
					}
				}
				if(addressToMultichainBalances[address]) {
					addressToMultichainBalances[address][network] = balances;
				} else {
					addressToMultichainBalances[address] = {};
					addressToMultichainBalances[address][network] = balances;
				}
			}
		}
	}

	// Get base asset values
	let baseAssetQueryString = Object.entries(networkToBaseAssetId).map(([key, value]) => value).join(',');
	let baseAssetPrices = await fetchBaseAssetCoingeckoPrices(baseAssetQueryString)
	if(debugMode) {
		console.log({baseAssetPrices})
	}

	await sleep(3000);

	for(let [network, entries] of Object.entries(tokenAddressList)) {
		if(entries.length > 0) {
			if(debugMode) {
				console.log({network, entries})
			}
			let coingeckoNetwork = networkToCoingeckoId[network];
			await sleep(3000);
			let coingeckoPrices = await fetchCoingeckoPrices(entries.join(','), coingeckoNetwork);
			networkToCoingeckoPrices[network] = coingeckoPrices;
		}
	}

	for(let [address, networksToBalances] of Object.entries(addressToMultichainBalances)) {
		for(let [network, chainBalances] of Object.entries(networksToBalances)) {
			for(let [tokenAddress, balanceEntry] of Object.entries(chainBalances)) {
				let coingeckoPrice = networkToCoingeckoPrices[network][tokenAddress];
				if(coingeckoPrice) {
					// TEMP ignore WETH until on-chain balance checks
					if(balanceEntry.tokenInfo.symbol !== 'WETH') {
						let tokenBalanceValue = new BigNumber(utils.formatUnits(balanceEntry.balance, balanceEntry.tokenInfo.decimal)).multipliedBy(coingeckoPrice).toString();
						tempUSD = new BigNumber(tempUSD).plus(tokenBalanceValue).toString();
						if(tokenAddressToNameToUsd[balanceEntry.tokenInfo.address]?.[balanceEntry.tokenInfo.symbol]) {
							tokenAddressToNameToUsd[balanceEntry.tokenInfo.address][balanceEntry.tokenInfo.symbol] = new BigNumber(tokenAddressToNameToUsd[balanceEntry.tokenInfo.address][balanceEntry.tokenInfo.symbol]).plus(tokenBalanceValue).toString();
						} else {
							if(!tokenAddressToNameToUsd[balanceEntry.tokenInfo.address]) {
								tokenAddressToNameToUsd[balanceEntry.tokenInfo.address] = {};
								tokenAddressToNameToUsd[balanceEntry.tokenInfo.address][balanceEntry.tokenInfo.symbol] = tokenBalanceValue;
							} else {
								tokenAddressToNameToUsd[balanceEntry.tokenInfo.address][balanceEntry.tokenInfo.symbol] = new BigNumber(tokenAddressToNameToUsd[balanceEntry.tokenInfo.address][balanceEntry.tokenInfo.symbol]).plus(tokenBalanceValue).toString();
							}
						}
					}
				}
			}
		}
	}

	for(let [holder, baseHoldings] of Object.entries(addressToMultichainBaseBalance)) {
		for(let [baseAssetNetwork, baseAssetAmountRaw] of Object.entries(baseHoldings)) {
			let baseAssetKey = networkToBaseAssetId[baseAssetNetwork];
			let baseAssetPrice = baseAssetPrices?.[baseAssetKey]?.usd;
			if(baseAssetPrice) {
				if(debugMode) {
					console.log({baseAssetAmountRaw, baseAssetPrice, baseAssetKey})
				}
				let baseAssetAmount = new BigNumber(utils.formatUnits(baseAssetAmountRaw, 18)).multipliedBy(baseAssetPrice).toString();
				tempUSD = new BigNumber(tempUSD).plus(baseAssetAmount).toString();
			}
		}
	}

	console.log(`Full sync of successful, exec time: ${new Date().getTime() - startTime}ms, finished at ${new Date().toISOString()}`)
	console.log({
		// addressToNetworkToLatestBlock,
		// tokenAddressToNameToUsd,
		// addressToMultichainBaseBalance,
		tempUSD,
		'timestamp': new Date().toISOString()
	});
	// for(let [address, entry] of Object.entries(addressToNetworkToLatestBlock)) {
	// 	for(let [network, latestBlock] of Object.entries(addressToNetworkToLatestBlock[address])) {
	// 		// Check for latest sync record
	// 		let latestSyncRecord = await SyncTrackRepository.getSyncTrack(address, network, 'erc20-sync');
	// 		if(!latestSyncRecord) {
	// 			// create
	// 			await SyncTrackRepository.create({
	// 				address: address,
	// 				network,
	// 				meta: 'erc20-sync',
	// 				latest_block_synced: latestBlock,
	// 			})
	// 		} else {
	// 			// update
	// 			await SyncTrackRepository.update({
	// 				latest_block_synced: latestBlock
	// 			}, latestSyncRecord.id);
	// 		}
	// 	}
	// }
}

const runCheckpointSyncTracker = new CronJob(
	'0 */1 * * * *',
	function() {
    let useTimestampUnix = Math.floor(new Date().setSeconds(0) / 1000);
    let startTime = new Date().getTime();
    runFullSync(useTimestampUnix, startTime);
	},
	null,
	true,
	'Etc/UTC'
);

// runCheckpointSyncTracker.start();

export const EthersProviderEthereum = new providers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_ETHEREUM}`);
// export const EthersProviderEthereum = new providers.AlchemyWebSocketProvider("homestead", ALCHEMY_API_KEY_ETHEREUM);
export const MulticallProviderEthereum = new Provider(EthersProviderEthereum);

MulticallProviderEthereum.init();

export const EthersProviderOptimism = new providers.AlchemyWebSocketProvider("optimism", ALCHEMY_API_KEY_OPTIMISM);
export const MulticallProviderOptimism = new Provider(EthersProviderOptimism, 10);

MulticallProviderOptimism.init();

export const EthersProviderArbitrum = new providers.AlchemyWebSocketProvider("arbitrum", ALCHEMY_API_KEY_ARBITRUM);
export const MulticallProviderArbitrum = new Provider(EthersProviderArbitrum, 42161);

MulticallProviderArbitrum.init();

// const runFullSyncTracker = new CronJob(
// 	`20 */${contractEventIndexerPeriodMinutes} * * * *`, // runs at 20 seconds past the minute on contractEventIndexerPeriodMinutes to offset it from the minutely runner which usually takes around 5-10 seconds
// 	function() {
//     let useTimestampUnix = Math.floor(new Date().setSeconds(0) / 1000);
//     let startTime = new Date().getTime();
// 		// fullSyncTracker(useTimestampUnix, startTime);
// 	},
// 	null,
// 	true,
// 	'Etc/UTC'
// );

// runFullSyncTracker.start();