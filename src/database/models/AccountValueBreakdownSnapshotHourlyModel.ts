import { 
  ACCOUNT_VALUE_BREAKDOWN_SNAPSHOT_HOURLY_TABLE,
  ASSET_TABLE,
  ACCOUNT_TABLE,
} from "../tables";
import BaseModel from "./BaseModel";
import AssetModel from "./AssetModel";

export default class AccountValueBreakdownSnapshotHourlyModel extends BaseModel {
    static get tableName() {
        return ACCOUNT_VALUE_BREAKDOWN_SNAPSHOT_HOURLY_TABLE
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
              from: `${ACCOUNT_VALUE_BREAKDOWN_SNAPSHOT_HOURLY_TABLE}.asset_address`,
              to: `${ASSET_TABLE}.address`,
          }
        },
        account: {
          relation: BaseModel.HasOneRelation,
          modelClass: AssetModel,
          join: {
              from: `${ACCOUNT_VALUE_BREAKDOWN_SNAPSHOT_HOURLY_TABLE}.holder_address`,
              to: `${ACCOUNT_TABLE}.address`,
          }
        },
      }
    }
}