import { BUNDLE_CONTENT_TABLE } from "../tables";
import BaseModel from "./BaseModel";

export default class BundleContentModel extends BaseModel {
    static get tableName() {
        return BUNDLE_CONTENT_TABLE
    }

    static get idColumn() {
        return "id"
    }
}