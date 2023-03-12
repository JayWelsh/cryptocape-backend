import { ResyncTrackModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class ResyncTrackRepository extends BaseRepository {
  getModel() {
    return ResyncTrackModel
  }

  async getResyncInProgress(accountAddress: string) {

    const results = await this.model.query()
      .where(function (this: QueryBuilder<ResyncTrackModel>) {
        this.where('address', accountAddress);
        this.where('is_busy', true);
      }).first();

    return this.parserResult(results);

  }
}

export default new ResyncTrackRepository()
