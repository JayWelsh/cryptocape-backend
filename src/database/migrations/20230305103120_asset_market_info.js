const { 
  ASSET_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.alterTable(ASSET_TABLE, table => {
  table.decimal("market_cap_usd", 28, 10);
  table.decimal("volume_24hr_usd", 28, 10);
  table.decimal("change_24hr_usd_percent", 28, 10);
});

exports.down = (knex) => knex.schema.alterTable(ASSET_TABLE, table => {
  table.dropColumn("market_cap_usd");
  table.dropColumn("volume_24hr_usd");
  table.dropColumn("change_24hr_usd_percent");
});