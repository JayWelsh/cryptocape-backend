const {
  ASSET_TABLE,
  NETWORK_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.alterTable(ASSET_TABLE, table => {
  return true;
}).then(function () {
  return knex(NETWORK_TABLE).insert([
    {
      name: "celestia",
    },
  ]);
}).then(function () {
  return knex(ASSET_TABLE).insert([
    {
      address: "TIA",
      network_name: "celestia",
      symbol: "TIA",
      is_base_asset: true,
      standard: "BASE",
      decimals: 6,
      name: "Celestia"
    },
  ]);
});

exports.down = knex => knex.schema.alterTable(ASSET_TABLE, table => {
  return true;
}).then(function () {
  return knex(NETWORK_TABLE).where("name", "celestia").delete();
}).then(function () {
  return knex(ASSET_TABLE).where("address", "TIA").delete();
});