'use strict';

import { Express } from "express";

const BalanceRoutes = require('./balance.routes');
const ValueSnapshotRoutes = require('./value-snapshot.routes');

export default function routes(app: Express) {
  app.use("", BalanceRoutes);
  app.use("", ValueSnapshotRoutes);
}