const { NETWORK_TABLE } = require("../tables");

exports.up = (knex) => knex.schema.createTable(NETWORK_TABLE, table => {
    table.increments();
    table.string("name").index().unique().notNullable();
    table.timestamps(true, true);
}).then(function () {
    return knex(NETWORK_TABLE).insert([
      {
        name: "ethereum",
      },
      {
        name: "arbitrum",
      },
      {
        name: "optimism",
      },
      {
        name: "canto",
      },
    ]);
});

exports.down = knex => knex.schema.dropTable(NETWORK_TABLE);