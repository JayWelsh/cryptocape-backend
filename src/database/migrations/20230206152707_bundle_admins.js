const { 
  ACCOUNT_TABLE,
  BUNDLE_ADMIN_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.createTable(BUNDLE_ADMIN_TABLE, table => {
    table.increments();
    table.string("admin_address")
      .index()
      .references(`${ACCOUNT_TABLE}.address`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE')
      .nullable();
    table.string("bundle_id").unique().index();
    table.timestamps(true, true);
});

exports.down = knex => knex.schema.dropTable(BUNDLE_ADMIN_TABLE);