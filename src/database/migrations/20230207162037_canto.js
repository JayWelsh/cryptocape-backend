const { ACCOUNT_TABLE } = require("../tables");

exports.up = (knex) => knex.schema.alterTable(ACCOUNT_TABLE, table => {
    table.boolean("canto_enabled").defaultTo(false).index();
});

exports.down = (knex) => knex.schema.alterTable(ACCOUNT_TABLE, table => {
  table.dropColumn("canto_enabled");
});