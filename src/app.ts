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

import {
  Multicall,
} from 'ethereum-multicall';

// switch to https://www.npmjs.com/package/myethereum-multicall2.0/v/2.4.5 for multicalls

import {
  ALCHEMY_API_KEY_ETHEREUM,
	ALCHEMY_API_KEY_OPTIMISM,
	ALCHEMY_API_KEY_ARBITRUM,
	networkToCoingeckoId,
	networkToBaseAssetId,
	baseAssetIdToSymbol,
	debugMode,
} from "./constants"

import routes from "./routes";
import dbConfig from "./config/database";

import {
	AccountRepository,
	SyncTrackRepository,
	AssetRepository,
	NetworkRepository,
	AccountValueBreakdownSnapshotRepository,
	AccountValueSnapshotRepository,
} from "./database/repositories";

import {
	getTokenInfoERC20
} from './web3/jobs';

import { runAccountFullNetworkSync } from './tasks/full-sync-account-network';
import {
	fetchCoingeckoPrices,
	fetchBaseAssetCoingeckoPrices,
} from './tasks/fetch-coingecko-prices';
import {
	patchMissingCoingeckoIds,
} from './tasks/patch-missing-coingecko-ids'
import {
  getCombinedValueBreakdownOfAccounts,
} from './tasks/get-combined-value-breakdown-of-accounts';

import { sleep } from "./utils";

import {
	IBalanceEntry,
	ICoingeckoAssetPriceEntry,
	IToken,
	IAddressToMultichainBaseBalance,
	ITokenAddressList,
	IAddressToNetworkToLatestBlock,
	IAddressToMultichainBalances,
} from './interfaces';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

// minutely cycle to run indexer, 10 = 10 minutes (i.e. 10, 20, 30, 40, 50, 60 past the hour).
// recommend to use 10 if doing a full sync, once up to speed, 2 minutes should be safe.
let contractEventIndexerPeriodMinutes = 2;

let corsOptions = {
  origin: ['http://localhost:3000', 'https://cryptocape.com', 'https://beta.cryptocape.com', null, 'null'],
}

dotenv.config();

// DB
const knex = Knex(dbConfig);
Model.knex(knex);

const app = express();
const port = process.env.PORT || 8420;

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

routes(app);

app.listen(port);

console.log(`----- ⚡ SERVER LISTENING ⚡ -----`);
console.log(`-------- ⚡ PORT: ${port} ⚡ --------`);

const runFullSync = async (useTimestampUnix: number, startTime: number) => {

	try {
		let accounts = await AccountRepository.getActiveAccounts();

		console.log(`Syncing ${accounts.filter((entry: any) => entry.enabled).length} accounts`);

		let postgresTimestamp = Math.floor(new Date().setSeconds(0) / 1000);

		let tempUSD = "0";
		let addressToNetworkToLatestBlock : IAddressToNetworkToLatestBlock = {};
		let tokenAddressToNameToUsd : {[key: string]: {[key: string]: string}} = {} = {};
		let tokenAddressList: ITokenAddressList = {};
		let networkToCoingeckoPrices : {[key: string]: {[key: string]: ICoingeckoAssetPriceEntry}} = {};
		let addressToMultichainBalances : IAddressToMultichainBalances = {};
		let addressToMultichainBaseBalance : IAddressToMultichainBaseBalance = {};

		for(let account of accounts) {

			let {
				address,
				ethereum_enabled,
				optimism_enabled,
				arbitrum_enabled,
				canto_enabled,
			} = account;

			address = utils.getAddress(address);

			let networks = [];

			if(ethereum_enabled) {
				networks.push("ethereum");
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

			await Promise.all(networks.map((network) => 
				runAccountFullNetworkSync(
					network,
					address,
					postgresTimestamp,
					tokenAddressList,
					addressToMultichainBalances,
					addressToNetworkToLatestBlock,
					addressToMultichainBaseBalance
				)
			))

		}

		// Get base asset values
		let baseAssetQueryString = Object.entries(networkToBaseAssetId).map(([key, value]) => value).join(',');
		let baseAssetPrices = await fetchBaseAssetCoingeckoPrices(baseAssetQueryString)
		if(debugMode) {
			console.log({baseAssetPrices})
		}

		// await sleep(3000);

		for(let [network, entries] of Object.entries(tokenAddressList)) {
			if(entries.length > 0) {
				if(debugMode) {
					console.log({network, entries})
				}
				let coingeckoNetwork = networkToCoingeckoId[network];
				// await sleep(2500);
				let coingeckoPrices = await fetchCoingeckoPrices(entries.join(','), coingeckoNetwork);
				networkToCoingeckoPrices[network] = coingeckoPrices;
			}
		}

		for(let [address, networksToBalances] of Object.entries(addressToMultichainBalances)) {
			for(let [network, chainBalances] of Object.entries(networksToBalances)) {
				for(let [tokenAddress, balanceEntry] of Object.entries(chainBalances)) {
					let coingeckoPrice = networkToCoingeckoPrices[network][tokenAddress];
					if(coingeckoPrice?.usd) {
						let tokenBalanceValue = new BigNumber(utils.formatUnits(balanceEntry.balance, balanceEntry.tokenInfo.decimal)).multipliedBy(coingeckoPrice.usd).toString();
						tempUSD = new BigNumber(tempUSD).plus(tokenBalanceValue).toString();
						if(new BigNumber(tokenBalanceValue).isGreaterThan(1)) {
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
				let baseAssetSymbol = baseAssetIdToSymbol[baseAssetKey];
				let baseAssetPrice = baseAssetPrices?.[baseAssetKey]?.usd;
				if(debugMode) {
					console.log({baseAssetAmountRaw, baseAssetPrice, baseAssetKey, baseAssetSymbol, tokenAddressToNameToUsd})
				}
				if(baseAssetPrice) {
					let baseAssetAmount = new BigNumber(utils.formatUnits(baseAssetAmountRaw, 18)).multipliedBy(baseAssetPrice).toString();
					if(tokenAddressToNameToUsd[baseAssetSymbol]?.[baseAssetSymbol]) {
						tokenAddressToNameToUsd[baseAssetSymbol][baseAssetSymbol] = new BigNumber(tokenAddressToNameToUsd[baseAssetSymbol][baseAssetSymbol]).plus(baseAssetAmount).toString();
					} else {
						if(!tokenAddressToNameToUsd[baseAssetSymbol]) {
							tokenAddressToNameToUsd[baseAssetSymbol] = {};
							tokenAddressToNameToUsd[baseAssetSymbol][baseAssetSymbol] = baseAssetAmount;
						} else {
							tokenAddressToNameToUsd[baseAssetSymbol][baseAssetSymbol] = new BigNumber(tokenAddressToNameToUsd[baseAssetSymbol][baseAssetSymbol]).plus(baseAssetAmount).toString();
						}
					}
					tempUSD = new BigNumber(tempUSD).plus(baseAssetAmount).toString();
				} else {
					throw new Error("Unable to fetch baseAssetPrice");
				}
			}
		}

		let tokenAddressToNameToUsdSorted = Object.entries(tokenAddressToNameToUsd).map(entry => entry[1]).sort((a, b) => {
			let aKey = Object.keys(a)[0]
			let bKey = Object.keys(b)[0]
			return new BigNumber(b[bKey]).minus(a[aKey]).toNumber();
		})

		console.log({
			// addressToNetworkToLatestBlock,
			// tokenAddressToNameToUsd,
			tokenAddressToNameToUsdSorted,
			// addressToMultichainBaseBalance,
			totalUSD: tempUSD,
			'timestamp': new Date().toISOString()
		});
		console.log(`Full sync of successful, exec time: ${new Date().getTime() - startTime}ms, finished at ${new Date().toISOString()}`)
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
	} catch (e) {
		console.error("Could not complete sync, error: ", e);
	}
}

const runPriceSync = async (useTimestampUnix: number, startTime: number) => {

	try {
		let networks = await NetworkRepository.getNetworks();

		let postgresTimestamp = Math.floor(new Date().setSeconds(0) / 1000);

		// Get base asset values
		let baseAssetQueryString = Object.entries(networkToBaseAssetId).map(([key, value]) => value).join(',');
		let baseAssetPrices = await fetchBaseAssetCoingeckoPrices(baseAssetQueryString);

		for(let network of networks) {

			let {
				name: networkName
			} = network;

			console.log(`Syncing ${networkName} prices`);

			let nonBaseAssetsOnNetwork = await AssetRepository.getNonBaseAssetByNetwork(networkName);

			// Get non-base asset values
			let nonBaseAssetQueryString = nonBaseAssetsOnNetwork.map((item: IToken) => item.address).join(',');
			let coingeckoNetwork = networkToCoingeckoId[networkName];
			let assetPrices = await fetchCoingeckoPrices(nonBaseAssetQueryString, coingeckoNetwork);
			for(let [assetAddress, assetPrice] of Object.entries(assetPrices)) {

				if(new BigNumber(assetPrice?.usd).isGreaterThan(0)) {
					await AssetRepository.updateLastPriceOfAsset(assetAddress, assetPrice?.usd);
				} else {
					await AssetRepository.updateLastPriceOfAsset(assetAddress, "0");
				}

				if(new BigNumber(assetPrice?.usd_24h_vol).isGreaterThan(0)) {
					await AssetRepository.update24HrVolumeOfAsset(assetAddress, assetPrice?.usd_24h_vol);
				} else {
					await AssetRepository.update24HrVolumeOfAsset(assetAddress, "0");
				}

				if(new BigNumber(assetPrice?.usd_market_cap).isGreaterThan(0)) {
					await AssetRepository.updateMarketCapOfAsset(assetAddress, assetPrice?.usd_market_cap);
				} else {
					await AssetRepository.updateMarketCapOfAsset(assetAddress, "0");
				}

				if(!(new BigNumber(assetPrice?.usd_24h_change).isNaN())) {
					await AssetRepository.update24HrChangePercentOfAsset(assetAddress, assetPrice?.usd_24h_change);
				} else {
					await AssetRepository.update24HrChangePercentOfAsset(assetAddress, "0");
				}

			}

			// await sleep(1000);

		}

		// Get base asset values
		for(let [baseAssetNetworkKey, baseAssetPriceObject] of Object.entries(baseAssetPrices)) {
			if(new BigNumber(baseAssetPriceObject.usd).isGreaterThan(0)) {
				await AssetRepository.updateLastPriceOfAsset(baseAssetIdToSymbol[baseAssetNetworkKey], baseAssetPriceObject.usd.toString());
			}  else {
				await AssetRepository.updateLastPriceOfAsset(baseAssetIdToSymbol[baseAssetNetworkKey], "0");
			}

			if(new BigNumber(baseAssetPriceObject?.usd_24h_vol).isGreaterThan(0)) {
				await AssetRepository.update24HrVolumeOfAsset(baseAssetIdToSymbol[baseAssetNetworkKey], baseAssetPriceObject?.usd_24h_vol);
			} else {
				await AssetRepository.update24HrVolumeOfAsset(baseAssetIdToSymbol[baseAssetNetworkKey], "0");
			}

			if(new BigNumber(baseAssetPriceObject?.usd_market_cap).isGreaterThan(0)) {
				await AssetRepository.updateMarketCapOfAsset(baseAssetIdToSymbol[baseAssetNetworkKey], baseAssetPriceObject?.usd_market_cap);
			} else {
				await AssetRepository.updateMarketCapOfAsset(baseAssetIdToSymbol[baseAssetNetworkKey], "0");
			}

			if(!(new BigNumber(baseAssetPriceObject?.usd_24h_change).isNaN())) {
				await AssetRepository.update24HrChangePercentOfAsset(baseAssetIdToSymbol[baseAssetNetworkKey], baseAssetPriceObject?.usd_24h_change);
			} else {
				await AssetRepository.update24HrChangePercentOfAsset(baseAssetIdToSymbol[baseAssetNetworkKey], "0");
			}
		}

		console.log(`Price sync successful, exec time: ${new Date().getTime() - startTime}ms, finished at ${new Date().toISOString()}`)
	} catch (e) {
		console.error("Could not complete price sync, error: ", e);
	}
}

const runAccountValueSnapshots = async (useTimestampUnix: number, startTime: number) => {

	try {

		let useTimestampPostgres = new Date(useTimestampUnix * 1000).toISOString();

		let accounts = await AccountRepository.getActiveAccounts();

		console.log(`Taking a value breakdown snapshot of ${accounts.filter((entry: any) => entry.enabled).length} accounts`);

		let postgresTimestamp = Math.floor(new Date().setSeconds(0) / 1000);

		for(let account of accounts) {

			let {
				address,
			} = account;

			let { total, assetAddressToValue } = await getCombinedValueBreakdownOfAccounts([address]);

			await AccountValueSnapshotRepository.create({
				holder_address: address,
				value_usd: total,
				timestamp: useTimestampPostgres,
			})

			for(let [assetAddress, tokenInfo] of Object.entries(assetAddressToValue)) {
				await AccountValueBreakdownSnapshotRepository.create({
					asset_address: assetAddress,
					holder_address: address,
					value_usd: tokenInfo.value,
					timestamp: useTimestampPostgres,
				})
			}
			
		}

		console.log(`Value breakdown snapshot successful, exec time: ${new Date().getTime() - startTime}ms, finished at ${new Date().toISOString()}`)

	} catch (e) {
		console.error("Could not complete account value snapshots, error: ", e);
	}

}

const fullSyncTracker = async () => {
	let useTimestampUnix = Math.floor(new Date().setSeconds(0) / 1000);
	let startTime = new Date().getTime();
	runFullSync(useTimestampUnix, startTime);
}

fullSyncTracker();

// const runFullSyncTracker = new CronJob(
// 	'0 */10 * * * *',
// 	function() {
// 		fullSyncTracker();
// 	},
// 	null,
// 	true,
// 	'Etc/UTC'
// );

// runFullSyncTracker.start();

const snapSyncTracker = async () => {
	let useTimestampUnix = Math.floor(new Date().setSeconds(0) / 1000);
	let startTimePriceSync = new Date().getTime();
	await runPriceSync(useTimestampUnix, startTimePriceSync);
	await patchMissingCoingeckoIds();
	let is10MinuteMark = (useTimestampUnix % 600) === 0;
	if(is10MinuteMark) {
		let startTimeValueSnapshot = new Date().getTime();
		await runAccountValueSnapshots(useTimestampUnix, startTimeValueSnapshot);
	}
}

const runSnapSyncTracker = new CronJob(
	'0 */1 * * * *',
	function() {
		snapSyncTracker();
	},
	null,
	true,
	'Etc/UTC'
);

runSnapSyncTracker.start();

export const EthersProviderEthereum = new providers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY_ETHEREUM}`);
// export const EthersProviderEthereum = new providers.AlchemyWebSocketProvider("homestead", ALCHEMY_API_KEY_ETHEREUM);
export const MulticallProviderEthereum = new Provider(EthersProviderEthereum);
export const MulticallProviderEthereumLib2 = new Multicall({ ethersProvider: EthersProviderEthereum, tryAggregate: true });

MulticallProviderEthereum.init();

export const EthersProviderOptimism = new providers.AlchemyWebSocketProvider("optimism", ALCHEMY_API_KEY_OPTIMISM);
export const MulticallProviderOptimism = new Provider(EthersProviderOptimism, 10);
export const MulticallProviderOptimismLib2 = new Multicall({ ethersProvider: EthersProviderOptimism, tryAggregate: true });

MulticallProviderOptimism.init();

export const EthersProviderArbitrum = new providers.AlchemyWebSocketProvider("arbitrum", ALCHEMY_API_KEY_ARBITRUM);
export const MulticallProviderArbitrum = new Provider(EthersProviderArbitrum, 42161);
export const MulticallProviderArbitrumLib2 = new Multicall({ ethersProvider: EthersProviderArbitrum, tryAggregate: true });

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