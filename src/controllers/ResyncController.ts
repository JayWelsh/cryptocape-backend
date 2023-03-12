import { validationResult } from "express-validator";
import e, { Request, Response } from 'express';
import { utils } from "ethers";

import {
  AccountRepository,
  ResyncTrackRepository,
} from '../database/repositories';

import BigNumber from 'bignumber.js';

import {
  runAccountFullSync,
} from '../tasks/full-sync-account';

import Controller from './Controller';

BigNumber.config({ EXPONENTIAL_AT: [-1e+9, 1e+9] });

interface IResyncResultEntry {
  account: string
  status: string
}

interface IAddressForSyncEntry {
  address: string
  resyncTrackEntryId: number
}

class ResyncController extends Controller {
  async resyncAccounts(req: Request, res: Response) {

    const errors = await validationResult(req);
    if (!errors.isEmpty()) {
      return this.sendResponse(res, {errors: errors.array()}, "Validation error", 422);
    }

    const {
      account_addresses,
    } = req.body;

    let response : IResyncResultEntry[] = [];

    let addressesForSync : IAddressForSyncEntry[] = [];

    for(let address of account_addresses) {
      let checksumAddress = utils.getAddress(address);
      // Check if account exists
      let accountRecord = await AccountRepository.getAccountByAddress(checksumAddress);
      if(accountRecord.id) {
        // Check if there is already a busy sync in progress
        let inProgressSync = await ResyncTrackRepository.getResyncInProgress(checksumAddress);
        if(inProgressSync) {
          // todo expire sync if over a certain time and retry
          response.push({
            account: checksumAddress,
            status: 'already-busy',
          })
        } else {
          // create resync track record
          response.push({
            account: checksumAddress,
            status: 'starting',
          });
          let startTime = new Date(new Date().getTime()).toISOString();
          let resyncTrackEntry = await ResyncTrackRepository.create({ address: checksumAddress, start_time: startTime, is_busy: true })
          addressesForSync.push({
            address: checksumAddress,
            resyncTrackEntryId: resyncTrackEntry.id,
          });
        }
      } else {
        response.push({
          account: checksumAddress,
          status: 'not-found',
        })
      }
    }
    
    this.sendResponse(res, {success: true, data: response});

    for(let entry of Object.entries(addressesForSync)) {
      let {
        address,
        resyncTrackEntryId,
      } = entry[1];
      await runAccountFullSync(address);
      let endTime = new Date(new Date().getTime()).toISOString();
      await ResyncTrackRepository.update({ address: address, end_time: endTime, is_busy: false, is_successful: true }, resyncTrackEntryId);
    }
  }
}

export default ResyncController;