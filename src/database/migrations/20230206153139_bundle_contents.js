const {
    BUNDLE_CONTENT_TABLE,
    ACCOUNT_TABLE,
    BUNDLE_ADMIN_TABLE,
} = require("../tables");

exports.up = (knex) => knex.schema.createTable(BUNDLE_CONTENT_TABLE, table => {
    table.increments();
    table.string("address")
        .index()
        .references(`${ACCOUNT_TABLE}.address`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE')
        .nullable();
    table.string("bundle_id")
        .index()
        .references(`${BUNDLE_ADMIN_TABLE}.bundle_id`)
        .onUpdate('CASCADE')
        .onDelete('CASCADE')
        .nullable();
    table.timestamps(true, true);
});

exports.down = knex => knex.schema.dropTable(BUNDLE_CONTENT_TABLE);