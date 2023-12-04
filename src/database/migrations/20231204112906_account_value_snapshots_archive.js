const {
  ACCOUNT_TABLE,
  ACCOUNT_VALUE_SNAPSHOT_TABLE,
  ACCOUNT_VALUE_SNAPSHOT_ARCHIVE_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.createTable(ACCOUNT_VALUE_SNAPSHOT_ARCHIVE_TABLE, table => {
    table.increments();
    table.string("holder_address")
      .index()
      .references(`${ACCOUNT_TABLE}.address`)
      .onUpdate('CASCADE')
      .onDelete('CASCADE')
      .notNullable();
    table.decimal("value_usd", 18, 2).defaultTo(0).notNullable();
    table.timestamp('timestamp').index().notNullable();
    table.timestamps(true, true);
}).then(async () => {
  await knex(ACCOUNT_VALUE_SNAPSHOT_TABLE)
  .select('*')
  .then(async (snapshots) => {
    for(let snapshot of snapshots) {
      await knex(ACCOUNT_VALUE_SNAPSHOT_ARCHIVE_TABLE).insert({
        holder_address: snapshot.holder_address,
        value_usd: snapshot.value_usd,
        timestamp: snapshot.timestamp,
      })
    }
  });
})

exports.down = knex => knex.schema.dropTable(ACCOUNT_VALUE_SNAPSHOT_ARCHIVE_TABLE);