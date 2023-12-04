import { AccountValueBreakdownSnapshotHourlyModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class AccountValueBreakdownSnapshotHourlyRepository extends BaseRepository {
  getModel() {
    return AccountValueBreakdownSnapshotHourlyModel
  }
}

export default new AccountValueBreakdownSnapshotHourlyRepository()
