const { ACCOUNT_TABLE } = require("../tables");

exports.up = (knex) => knex.schema.alterTable(ACCOUNT_TABLE, table => {
  table.renameColumn("mainnet_enabled", "ethereum_enabled");
});

exports.down = (knex) => knex.schema.alterTable(ACCOUNT_TABLE, table => {
  table.renameColumn("ethereum_enabled", "mainnet_enabled");
});