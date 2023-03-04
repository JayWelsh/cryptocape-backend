import { 
  ACCOUNT_VALUE_SNAPSHOT_TABLE,
  ACCOUNT_TABLE,
} from "../tables";
import BaseModel from "./BaseModel";
import AssetModel from "./AssetModel";

export default class AccountValueSnapshotModel extends BaseModel {
    static get tableName() {
        return ACCOUNT_VALUE_SNAPSHOT_TABLE
    }

    static get idColumn() {
        return "id"
    }

    static get relationMappings() {
      return {
        account: {
          relation: BaseModel.HasOneRelation,
          modelClass: AssetModel,
          join: {
              from: `${ACCOUNT_VALUE_SNAPSHOT_TABLE}.holder_address`,
              to: `${ACCOUNT_TABLE}.address`,
          }
        },
      }
    }
}