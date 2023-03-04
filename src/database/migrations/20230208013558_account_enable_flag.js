const { ACCOUNT_TABLE } = require("../tables");

exports.up = (knex) => knex.schema.alterTable(ACCOUNT_TABLE, table => {
    table.boolean("enabled").defaultTo(true).index();
});

exports.down = (knex) => knex.schema.alterTable(ACCOUNT_TABLE, table => {
  table.dropColumn("enabled");
});