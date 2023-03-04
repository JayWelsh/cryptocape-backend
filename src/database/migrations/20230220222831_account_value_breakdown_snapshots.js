const {
  ACCOUNT_TABLE,
  ACCOUNT_VALUE_BREAKDOWN_SNAPSHOT_TABLE,
  ASSET_TABLE,
  NETWORK_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.createTable(ACCOUNT_VALUE_BREAKDOWN_SNAPSHOT_TABLE, table => {
    table.increments();
    table.string("asset_address")
      .index()
      .references(`${ASSET_TABLE}.address`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE')
      .notNullable();
    table.string("holder_address")
      .index()
      .references(`${ACCOUNT_TABLE}.address`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE')
      .notNullable();
    table.decimal("value_usd", 18, 2).defaultTo(0).notNullable();
    table.timestamp('timestamp').index().notNullable();
    table.timestamps(true, true);
});

exports.down = knex => knex.schema.dropTable(ACCOUNT_VALUE_BREAKDOWN_SNAPSHOT_TABLE);