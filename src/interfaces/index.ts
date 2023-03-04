// Internal Interfaces Below

export interface ITransformer {
  transform: (arg0: any) => any;
  constructor: any;
}

export interface IEtherscanTxERC20 {
  blockNumber: string
  timeStamp: string
  hash: string
  nonce: string
  blockHash: string
  from: string
  contractAddress: string
  to: string
  value: string
  tokenName: string
  tokenSymbol: string
  tokenDecimal: string
  transactionIndex: string
  gas: string
  gasPrice: string
  gasUsed: string
  cumulativeGasUsed: string
  input: string
  confirmations: string
}

export interface IToken {
  address: string
  name: string
  symbol: string
  decimal: string
  network: string
  standard: "ERC-20" | "ERC-721" | "ERC-1155"
}

export interface IBalanceEntry {
  tokenInfo: IToken
  latestBlock: string
  balance: string
}

export interface INetworkToBalancesERC20 {
  network: "ethereum" | "optimism" | "arbitrum"
  balances: IBalanceEntry,
}

export interface ITokenAddressToLastPrice {
  [key: string]: string
}

export interface ICoingeckoAssetPriceEntryResponse {
  [key: string]: ICoingeckoAssetPriceEntry
}

export interface ICoingeckoAssetPriceEntry {
  usd: number 
}

export interface INetwork {
  id: number
  name: string
}

export interface IAccountAssetValueEntry {
  balance: string,
  value: string;
  symbol: string;
  percentage_of_total: string;
  token_price: string;
}

export interface ITimeseries {
  value: string | number;
  timestamp: string;
}