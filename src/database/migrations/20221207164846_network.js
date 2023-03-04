const { NETWORK_TABLE } = require("../tables");

exports.up = (knex) => knex.schema.createTable(NETWORK_TABLE, table => {
    table.increments();
    table.string("name").index().unique().notNullable();
    table.timestamps(true, true);
});

exports.down = knex => knex.schema.dropTable(NETWORK_TABLE);