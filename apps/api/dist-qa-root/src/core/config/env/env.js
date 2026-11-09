"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
require("dotenv/config");
const env_schema_1 = require("./env.schema");
const parsedEnv = env_schema_1.envSchema.safeParse(process.env);
if (!parsedEnv.success) {
    console.error('Invalid environment variables:', parsedEnv.error.flatten().fieldErrors);
    process.exit(1);
}
exports.env = parsedEnv.data;
//# sourceMappingURL=env.js.map