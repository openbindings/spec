#!/usr/bin/env node
import assert from "node:assert/strict";
import { conciseCoreAuthorityErrors as check } from "./concise-core-authority.mjs";
const valid = "This kind incorporates [OpenBindings Specification 0.2.0](../../openbindings.md).\n";
assert.deepEqual(check(valid, "test", "0.2.0"), []);
assert.equal(check("older candidate", "test", "0.2.0"), null);
for (const text of [valid + valid, valid.replace("0.2.0", "0.2.1"),
  valid.replace("../../openbindings.md", "wrong.md"), valid.replace("0.2.0", "0.2"),
  valid + "incorporates exactly version **0.1.0**", valid + "\nThis kind incorporates something else.\n",
  valid + "\n[OpenBindings Specification 0.1.0](../../openbindings.md)\n"]) {
  assert.ok(check(text, "test", "0.2.0").length, text);
}
console.log("Concise Core authority: rejects missing, conflicting, duplicate and wrong-target authority declarations.");
