import { AccountValueBreakdownSnapshotModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class AccountValueBreakdownSnapshotRepository extends BaseRepository {
  getModel() {
    return AccountValueBreakdownSnapshotModel
  }
}

export default new AccountValueBreakdownSnapshotRepository()
