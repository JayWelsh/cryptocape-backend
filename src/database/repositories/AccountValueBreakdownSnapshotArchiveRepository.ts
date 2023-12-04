import { AccountValueBreakdownSnapshotArchiveModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class AccountValueBreakdownSnapshotArchiveRepository extends BaseRepository {
  getModel() {
    return AccountValueBreakdownSnapshotArchiveModel
  }
}

export default new AccountValueBreakdownSnapshotArchiveRepository()
