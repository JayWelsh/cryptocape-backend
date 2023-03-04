import { SyncTrackModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class SyncTrackRepository extends BaseRepository {
  getModel() {
    return SyncTrackModel
  }

  async getSyncTrack(accountAddress: string, network: string, meta: string) {

    const results = await this.model.query()
      .where(function (this: QueryBuilder<SyncTrackModel>) {
        this.where('address', accountAddress);
        this.where('network', network);
        this.where('meta', meta);
      }).first();

    return this.parserResult(results);

  }
}

export default new SyncTrackRepository()
