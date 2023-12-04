import { AccountValueBreakdownSnapshotDailyModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class AccountValueBreakdownSnapshotDailyRepository extends BaseRepository {
  getModel() {
    return AccountValueBreakdownSnapshotDailyModel
  }
}

export default new AccountValueBreakdownSnapshotDailyRepository()
