'use strict';

import { body } from 'express-validator';

import {
  isETHAddressArray,
} from "../web3/utils";

import Router from "./Router";

// todo add access control
Router.post('/resync/accounts', [
  body('account_addresses').isArray().notEmpty().custom(isETHAddressArray),
], 'ResyncController@resyncAccounts');

module.exports = Router.export();