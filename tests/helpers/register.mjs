// Registers the "@/" alias hooks for the test runner.
// Used via: node --import ./tests/helpers/register.mjs
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
