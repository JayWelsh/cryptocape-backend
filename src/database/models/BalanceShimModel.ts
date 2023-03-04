import { BALANCE_SHIM_TABLE, ASSET_TABLE } from "../tables";
import BaseModel from "./BaseModel";
import AssetModel from "./AssetModel";

export default class BalanceShimModel extends BaseModel {
    static get tableName() {
        return BALANCE_SHIM_TABLE
    }

    static get idColumn() {
        return "id"
    }

    static get relationMappings() {
      return {
        asset: {
          relation: BaseModel.HasOneRelation,
          modelClass: AssetModel,
          join: {
              from: `${BALANCE_SHIM_TABLE}.asset_address`,
              to: `${ASSET_TABLE}.address`,
          }
        },
      }
    }
}