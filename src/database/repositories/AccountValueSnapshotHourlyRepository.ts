import { AccountValueSnapshotHourlyModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class AccountValueSnapshotHourlyRepository extends BaseRepository {
  getModel() {
    return AccountValueSnapshotHourlyModel
  }

  async getSnapshotHistory(account: string) {
    const result = await this.model.query().where(function (this: QueryBuilder<AccountValueSnapshotHourlyModel>) {
      this.where('holder_address', account);
    }).orderBy('timestamp', 'ASC');

    return this.parserResult(result);
  }

  async getSnapshotHistoryByAddresses(accounts: string[]) {
    const result = await this.model.query().where(function (this: QueryBuilder<AccountValueSnapshotHourlyModel>) {
      this.whereIn('holder_address', accounts);
    }).orderBy('timestamp', 'ASC');

    return this.parserResult(result);
  }
}

export default new AccountValueSnapshotHourlyRepository()
