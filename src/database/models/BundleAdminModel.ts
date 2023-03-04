import { BUNDLE_ADMIN_TABLE } from "../tables";
import BaseModel from "./BaseModel";

export default class BundleAdminModel extends BaseModel {
    static get tableName() {
        return BUNDLE_ADMIN_TABLE
    }

    static get idColumn() {
        return "id"
    }
}