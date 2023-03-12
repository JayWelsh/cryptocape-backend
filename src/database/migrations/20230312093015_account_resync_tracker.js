const { 
  ACCOUNT_TABLE,
  RESYNC_TRACK_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.createTable(RESYNC_TRACK_TABLE, table => {
    table.increments();
    table.string("address")
      .index()
      .references(`${ACCOUNT_TABLE}.address`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE')
      .notNullable();
    table
      .string("meta")
      .index();
    table
      .boolean("is_busy")
      .defaultTo(false)
      .index();
    table
      .boolean("is_successful")
      .defaultTo(false)
      .index();
    table
      .boolean("is_error")
      .defaultTo(false)
      .index();
    table
      .boolean("is_cancelled")
      .defaultTo(false)
      .index();
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time');
    table.timestamps(true, true);
});

exports.down = knex => knex.schema.dropTable(RESYNC_TRACK_TABLE);