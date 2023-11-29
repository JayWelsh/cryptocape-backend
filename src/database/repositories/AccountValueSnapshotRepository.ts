import { AccountValueSnapshotModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class AccountValueSnapshotRepository extends BaseRepository {
  getModel() {
    return AccountValueSnapshotModel
  }

  async getSnapshotHistory(account: string) {
    const result = await this.model.query().where(function (this: QueryBuilder<AccountValueSnapshotModel>) {
      this.where('holder_address', account);
    }).orderBy('timestamp', 'ASC');

    return this.parserResult(result);
  }

  async getSnapshotHistoryByAddresses(accounts: string[]) {
    const result = await this.model.query().where(function (this: QueryBuilder<AccountValueSnapshotModel>) {
      this.whereIn('holder_address', accounts);
    }).orderBy('timestamp', 'ASC');

    return this.parserResult(result);
  }
}

export default new AccountValueSnapshotRepository()
