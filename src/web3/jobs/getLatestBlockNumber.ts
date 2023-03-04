import {
  EthersProviderEthereum,
} from "../../app";

export const getLatestBlockNumber = async () => {
  
  let blockNumber = await EthersProviderEthereum.getBlockNumber();

  return blockNumber;
  
}