import dotenv from "dotenv";

dotenv.config();

// Web3
export const ALCHEMY_API_KEY_ETHEREUM = process.env['ALCHEMY_API_KEY_ETHEREUM'];
export const ALCHEMY_API_KEY_OPTIMISM = process.env['ALCHEMY_API_KEY_OPTIMISM'];
export const ALCHEMY_API_KEY_ARBITRUM = process.env['ALCHEMY_API_KEY_ARBITRUM'];

// Block Explorers
export const ETHERSCAN_API_KEY = process.env['ETHERSCAN_API_KEY'];
export const ARBISCAN_API_KEY = process.env['ARBISCAN_API_KEY'];

// CoinGecko
export const COINGECKO_API_KEY = process.env['COINGECKO_API_KEY'];

export const networkToCoingeckoId: {[key: string]: string} = {
  "arbitrum": "arbitrum-one",
  "ethereum": "ethereum",
  "optimism": "optimistic-ethereum",
  "canto": "canto",
}

export const networkToBaseAssetId: {[key: string]: string} = {
  "arbitrum": "ethereum",
  "ethereum": "ethereum",
  "optimism": "optimism",
  "canto": "canto",
}

export const baseAssetIdToSymbol: {[key: string]: string} = {
  "arbitrum": "ETH",
  "ethereum": "ETH",
  "optimism": "OP",
  "canto": "CANTO",
}

export const debugMode = false;