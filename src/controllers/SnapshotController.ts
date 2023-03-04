import { validationResult } from "express-validator";
import e, { Request, Response } from 'express';
import { utils } from "ethers";

import {
  AssetRepository,
  BalanceRepository,
  BalanceShimRepository,
} from '../database/repositories';

import BigNumber from 'bignumber.js';

import {
  IAccountAssetValueEntry,
} from '../interfaces';

// import {
//   RateOutputTransformer
// } from '../database/transformers';

import {
  getTokenInfoERC20
} from '../web3/jobs';

import {
  getCombinedValueBreakdownTimeseries,
} from '../tasks/get-combined-account-value-snapshot-history-of-accounts';

import Controller from './Controller';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

class BalanceController extends Controller {
  async getCombinedAccountValueSnapshotHistory(req: Request, res: Response) {

    const {
      addresses = ""
    } = req.query;

    let addressesArray = addresses.toString().split(",");
    let result = await getCombinedValueBreakdownTimeseries(addressesArray);

    this.sendResponse(res, result);
  }
}

export default BalanceController;