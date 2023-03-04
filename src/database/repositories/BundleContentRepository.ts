import { BundleContentModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class BundleContentRepository extends BaseRepository {
  getModel() {
    return BundleContentModel
  }
}

export default new BundleContentRepository()
