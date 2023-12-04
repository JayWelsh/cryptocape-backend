import { AccountValueSnapshotArchiveModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class AccountValueSnapshotArchiveRepository extends BaseRepository {
  getModel() {
    return AccountValueSnapshotArchiveModel
  }

  async getSnapshotHistory(account: string) {
    const result = await this.model.query().where(function (this: QueryBuilder<AccountValueSnapshotArchiveModel>) {
      this.where('holder_address', account);
    }).orderBy('timestamp', 'ASC');

    return this.parserResult(result);
  }

  async getSnapshotHistoryByAddresses(accounts: string[]) {
    const result = await this.model.query().where(function (this: QueryBuilder<AccountValueSnapshotArchiveModel>) {
      this.whereIn('holder_address', accounts);
    }).orderBy('timestamp', 'ASC');

    return this.parserResult(result);
  }
}

export default new AccountValueSnapshotArchiveRepository()
