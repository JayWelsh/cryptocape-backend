import BigNumber from 'bignumber.js';

import { Contract, Event, utils } from 'ethers';

import { fetchHistoricalERC20TokenAddressesForAccount } from './fetch-historical-erc20-token-addresses-for-account';
import { syncAccountBalanceBaseAsset } from './sync-account-base-asset';
import { getLatestBlockNumber } from '../web3/jobs/getLatestBlockNumber';

import {
	SyncTrackRepository,
} from "../database/repositories";

import {
	IAddressToMultichainBaseBalance,
	ITokenAddressList,
	IAddressToNetworkToLatestBlock,
	IAddressToMultichainBalances,
} from '../interfaces';

import {
  extractFromBlockToBlock,
  getNetworkProvider,
} from '../web3/utils';

import {
  eventIndexer,
} from '../web3/jobs';

import {
  NETWORK_TO_MAX_BLOCK_BATCH_SIZE_TRANSFERS,
} from '../constants';

import ERC20ABI from '../web3/abis/ERC20ABI.json';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

export const runArchiveSyncAccountTransactions = async (
	network: string,
	address: string,
	postgresTimestamp: number,
	tokenAddressList?: ITokenAddressList,
	addressToMultichainBalances?: IAddressToMultichainBalances,
	addressToNetworkToLatestBlock?: IAddressToNetworkToLatestBlock,
	addressToMultichainBaseBalance?: IAddressToMultichainBaseBalance,
) => {

  let latestBlockNumber = await getLatestBlockNumber(network);

	let latestSyncRecord = await SyncTrackRepository.getSyncTrack(address, network, 'erc20-sync');
	let startBlock = latestSyncRecord?.latest_block_synced ? latestSyncRecord?.latest_block_synced : "0";

	let [
    // baseAssetBalance,
    balances
  ] = await Promise.all([
		// syncAccountBalanceBaseAsset(postgresTimestamp, new Date().getTime(), address, network),
		fetchHistoricalERC20TokenAddressesForAccount(postgresTimestamp, new Date().getTime(), address, network, startBlock),
	]);

  if(balances) {
    let erc20TokenAddresses = Object.entries(balances).map(([key, value]) => key);
    // console.log({network, erc20TokenAddresses})
    
    console.log(`Archiving transactions of ${erc20TokenAddresses.length} token addresses on ${network} for ${address}`);

    // For each ERC-20 address, get the entire transaction history associated with the account

    let currentTokenProgress = 1;
    let earliestBlock;
    let latestBlock;

    for(let tokenAddress of erc20TokenAddresses) {

      let eventIndexBlockTrackerRecord = {
        event_name: "transferFrom",
        last_checked_block: 0,
        genesis_block: Number(balances[tokenAddress].earliestBlock),
        meta: "transferFrom"
      }
      
      if(!earliestBlock || (Number(balances[tokenAddress].earliestBlock) < earliestBlock)) {
        earliestBlock = Number(balances[tokenAddress].earliestBlock);
      }

      if(!latestBlock || (Number(balances[tokenAddress].latestBlock) < latestBlock)) {
        latestBlock = Number(balances[tokenAddress].latestBlock);
      }

      let {
        fromBlock,
        toBlock,
        blockRange,
      } = extractFromBlockToBlock(latestBlockNumber, eventIndexBlockTrackerRecord);

      let provider = getNetworkProvider(network);

      if(provider) {

        const ERC20Contract = new Contract(tokenAddress, ERC20ABI);
        const erc20Contract = await ERC20Contract.connect(provider);
        const receiveTokenEventFilter = await erc20Contract.filters.Transfer(null, address);
        const sendTokenEventFilter = await erc20Contract.filters.Transfer(address, null);

        let maxBlockBatchSize = NETWORK_TO_MAX_BLOCK_BATCH_SIZE_TRANSFERS[network];

        // await Promise.all([
        //   eventIndexer(erc20Contract, null, receiveTokenEventFilter, latestBlockNumber, fromBlock, toBlock, blockRange, maxBlockBatchSize, network, `${tokenAddress} (Transfer Receives) - token ${currentTokenProgress} of ${erc20TokenAddresses.length} (fromBlock: ${fromBlock}, toBlock: ${toBlock}, blockRange: ${blockRange}, maxBlockBatchSize: ${maxBlockBatchSize})`),
        //   eventIndexer(erc20Contract, null, sendTokenEventFilter, latestBlockNumber, fromBlock, toBlock, blockRange, maxBlockBatchSize, network, `${tokenAddress} (Transfer Sends) - token ${currentTokenProgress} of ${erc20TokenAddresses.length} (fromBlock: ${fromBlock}, toBlock: ${toBlock}, blockRange: ${blockRange}, maxBlockBatchSize: ${maxBlockBatchSize})`)
        // ]).then(([
        //   receiveEvents,
        //   sendEvents
        // ]) => {
        //   console.log(`token ${currentTokenProgress} (${tokenAddress}) on ${network} had ${receiveEvents ? receiveEvents.length : 0} receive events and ${sendEvents ? sendEvents.length : 0} send events for address ${address}`);
        //   if(receiveEvents) {
        //     for(let receiveEvent of receiveEvents) {
        //       console.log({receiveEvent})
        //     }
        //   }
        //   if(sendEvents) {
        //     for(let sendEvent of sendEvents) {
        //       console.log({sendEvent})
        //     }
        //   }
        // })

        currentTokenProgress++;

      }

    }

    let provider = getNetworkProvider(network);

    if(provider) {

      let eventIndexBlockTrackerRecord = {
        event_name: "transferFrom",
        last_checked_block: 0,
        genesis_block: Number(earliestBlock),
        meta: "transferFrom"
      }

      let {
        fromBlock,
        toBlock,
        blockRange,
      } = extractFromBlockToBlock(latestBlockNumber, eventIndexBlockTrackerRecord);

      let maxBlockBatchSize = NETWORK_TO_MAX_BLOCK_BATCH_SIZE_TRANSFERS[network];

      let receiveTokenEventFilter = {
        topics : [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          null,
          utils.hexZeroPad(address, 32)
        ]
      };

      let sendTokenEventFilter = {
        topics : [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          utils.hexZeroPad(address, 32),
          null,
        ]
      }

      await Promise.all([
        eventIndexer(null, ERC20ABI, receiveTokenEventFilter, latestBlockNumber, fromBlock, toBlock, blockRange, maxBlockBatchSize, network, `NO CONTRACT ADDRESS Transfer Receives (network: ${network}, fromBlock: ${fromBlock}, toBlock: ${toBlock}, blockRange: ${blockRange}, maxBlockBatchSize: ${maxBlockBatchSize})`),
        eventIndexer(null, ERC20ABI, sendTokenEventFilter, latestBlockNumber, fromBlock, toBlock, blockRange, maxBlockBatchSize, network, `NO CONTRACT ADDRESS Transfer Sends (network: ${network}, fromBlock: ${fromBlock}, toBlock: ${toBlock}, blockRange: ${blockRange}, maxBlockBatchSize: ${maxBlockBatchSize})`)
      ]).then(([
        receiveEvents,
        sendEvents
      ]) => {
        console.log(`${network} had ${receiveEvents ? receiveEvents.length : 0} receive events and ${sendEvents ? sendEvents.length : 0} send events for address ${address}`);
        // if(receiveEvents) {
        //   for(let receiveEvent of receiveEvents) {
        //     console.log({receiveEvent})
        //   }
        // }
        // if(sendEvents) {
        //   for(let sendEvent of sendEvents) {
        //     console.log({sendEvent})
        //   }
        // }

        // {
        //   event: {
        //     blockNumber: 29617562,
        //     blockHash: '0x68228c72d35268027bcbed20a90b7de20ed98d9a0df6daadeea4a780b65bc0af',
        //     transactionIndex: 1,
        //     removed: false,
        //     address: '0xE1CC7371F2C2b7eBb1AF2b0C053Ec86596E3f6D0',
        //     data: '0x000000000000000000000000000000000000000000009c4c518c2e7e36240000',
        //     topics: [
        //       '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        //       '0x000000000000000000000000bb1a241dcbd6a3894cb61f659034874dc9cf65d4',
        //       '0x0000000000000000000000006904f0db06d0d45705b9fcdb17c90f6625226a9e'
        //     ],
        //     transactionHash: '0x5d44b65c7f507773f72e100d205a86a8db7747e77158f8d0254c46354b94f744',
        //     logIndex: 948
        //   }
        // }

        // {
        //   receiveEvent: LogDescription {
        //     eventFragment: {
        //       name: 'Transfer',
        //       anonymous: false,
        //       inputs: [Array],
        //       type: 'event',
        //       _isFragment: true,
        //       constructor: [Function],
        //       format: [Function (anonymous)]
        //     },
        //     name: 'Transfer',
        //     signature: 'Transfer(address,address,uint256)',
        //     topic: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        //     args: [
        //       '0xB38e8c17e38363aF6EbdCb3dAE12e0243582891D',
        //       '0x6904F0Db06d0D45705B9FcDB17c90F6625226A9e',
        //       [BigNumber],
        //       from: '0xB38e8c17e38363aF6EbdCb3dAE12e0243582891D',
        //       to: '0x6904F0Db06d0D45705B9FcDB17c90F6625226A9e',
        //       value: [BigNumber]
        //     ]
        //   }
        // }

        // {
        //   receiveEvent: {
        //     blockNumber: 15303231,
        //     blockHash: '0x8fe9598efb1bae70678e9db2e58bad56ca59d1b6d38b1d8c27746a27c8cfb981',
        //     transactionIndex: 37,
        //     removed: false,
        //     address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        //     data: '0x00000000000000000000000000000000000000000000000000007ac8230b7000',
        //     topics: [
        //       '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
        //       '0x0000000000000000000000005d3087d1aa04235610cad6198598977b9b8156d3',
        //       '0x0000000000000000000000006904f0db06d0d45705b9fcdb17c90f6625226a9e'
        //     ],
        //     transactionHash: '0x9d70f0f45d7929d3192ad9bdf8d86f881baeb2391eeb11f183d0aeaa0cd1404e',
        //     logIndex: 22,
        //     removeListener: [Function (anonymous)],
        //     getBlock: [Function (anonymous)],
        //     getTransaction: [Function (anonymous)],
        //     getTransactionReceipt: [Function (anonymous)],
        //     event: 'Transfer',
        //     eventSignature: 'Transfer(address,address,uint256)',
        //     decode: [Function (anonymous)],
        //     args: [
        //       '0x5d3087D1aA04235610CAd6198598977B9b8156D3',
        //       '0x6904F0Db06d0D45705B9FcDB17c90F6625226A9e',
        //       [BigNumber],
        //       from: '0x5d3087D1aA04235610CAd6198598977B9b8156D3',
        //       to: '0x6904F0Db06d0D45705B9FcDB17c90F6625226A9e',
        //       value: [BigNumber]
        //     ]
        //   }
        // }
      })

    }

  }

}