import { RESYNC_TRACK_TABLE } from "../tables";
import BaseModel from "./BaseModel";

export default class ResyncTrackModel extends BaseModel {
    static get tableName() {
        return RESYNC_TRACK_TABLE
    }

    static get idColumn() {
        return "id"
    }
}