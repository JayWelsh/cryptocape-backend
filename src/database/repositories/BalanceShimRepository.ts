import { BalanceShimModel } from "../models";
import BaseRepository from "./BaseRepository";
import { QueryBuilder } from "objection";
import Pagination, { IPaginationRequest } from "../../utils/Pagination";

class BalanceShimRepository extends BaseRepository {
  getModel() {
    return BalanceShimModel
  }

  async getBalanceShimByAssetAndHolder(assetAddress: string, holderAddress: string) {
    const result = await this.model.query().where(function (this: QueryBuilder<BalanceShimModel>) {
      this.where('asset_address', assetAddress);
      this.where('holder_address', holderAddress);
    }).first();

    return this.parserResult(result);
  }

  async getBalanceShimByHolder(holderAddress: string) {
    const result = await this.model.query().withGraphJoined('asset').where(function (this: QueryBuilder<BalanceShimModel>) {
      this.where('holder_address', holderAddress);
    });

    return this.parserResult(result);
  }
}

export default new BalanceShimRepository()
