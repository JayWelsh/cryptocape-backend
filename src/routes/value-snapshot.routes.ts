'use strict';

import { body } from 'express-validator';

import {
  isETHAddress,
  isSupportedNetwork,
  isValidBalance,
} from "../web3/utils";

import Router from "./Router";

Router.get('/history/account-value-snapshot', [], 'SnapshotController@getCombinedAccountValueSnapshotHistory');

module.exports = Router.export();