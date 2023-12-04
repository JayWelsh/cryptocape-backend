const {
  ACCOUNT_TABLE,
  ACCOUNT_VALUE_SNAPSHOT_TABLE,
  ACCOUNT_VALUE_SNAPSHOT_DAILY_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.createTable(ACCOUNT_VALUE_SNAPSHOT_DAILY_TABLE, table => {
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
      if(((new Date(snapshot.timestamp).getTime() / 1000) % (60*60*24) === 0)) {
        await knex(ACCOUNT_VALUE_SNAPSHOT_DAILY_TABLE).insert({
          holder_address: snapshot.holder_address,
          value_usd: snapshot.value_usd,
          timestamp: snapshot.timestamp,
        })
      }
    }
  });
})

exports.down = knex => knex.schema.dropTable(ACCOUNT_VALUE_SNAPSHOT_DAILY_TABLE);