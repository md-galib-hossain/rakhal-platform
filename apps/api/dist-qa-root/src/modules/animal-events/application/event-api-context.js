"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventApiContext = exports.runInEventApi = void 0;
const node_async_hooks_1 = require("node:async_hooks");
const store = new node_async_hooks_1.AsyncLocalStorage();
const runInEventApi = (ctx, fn) => store.run(ctx, fn);
exports.runInEventApi = runInEventApi;
const eventApiContext = () => store.getStore();
exports.eventApiContext = eventApiContext;
//# sourceMappingURL=event-api-context.js.map