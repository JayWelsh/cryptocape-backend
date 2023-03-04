const { ACCOUNT_TABLE } = require("../tables");

exports.up = (knex) => knex.schema.createTable(ACCOUNT_TABLE, table => {
    table.increments();
    table.string("address").index().unique().notNullable();
    table.boolean("mainnet_enabled").index();
    table.boolean("optimism_enabled").index();
    table.boolean("arbitrum_enabled").index();
    table.timestamps(true, true);
});

exports.down = knex => knex.schema.dropTable(ACCOUNT_TABLE);