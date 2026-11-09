"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.txStore = void 0;
const node_async_hooks_1 = require("node:async_hooks");
exports.txStore = new node_async_hooks_1.AsyncLocalStorage();
//# sourceMappingURL=tx-context.js.map