const {
  ASSET_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.alterTable(ASSET_TABLE, table => {
  table.boolean("is_base_asset").index().defaultTo(false).notNullable();
}).then(function () {
  return knex(ASSET_TABLE).insert([
    {
      address: "ETH",
      network_name: "ethereum",
      symbol: "ETH",
      is_base_asset: true,
      standard: "BASE",
      decimals: 18,
      name: "Ether"
    },
    {
      address: "OP",
      network_name: "optimism",
      is_base_asset: true,
      symbol: "OP",
      standard: "BASE",
      decimals: 18,
      name: "Optimism"
    },
    {
      address: "CANTO",
      network_name: "canto",
      is_base_asset: true,
      symbol: "CANTO",
      standard: "BASE",
      decimals: 18,
      name: "CANTO"
    },
  ]);
});

exports.down = knex => knex.schema.alterTable(ASSET_TABLE, table => {
  table.dropColumn("is_base_asset");
}).then(function () {
  return knex(ASSET_TABLE).where("standard", "BASE").delete();
});;