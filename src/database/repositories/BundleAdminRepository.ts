import { BundleAdminModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class BundleAdminRepository extends BaseRepository {
  getModel() {
    return BundleAdminModel
  }
}

export default new BundleAdminRepository()
