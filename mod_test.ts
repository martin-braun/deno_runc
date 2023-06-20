#!/usr/bin/env -S deno test --allow-env --allow-run
// Copyright 2023 Martin Braun. All rights reserved. MIT license.

import { assert, assertEquals } from "./deps.ts";
import { CommandError, type CommandResult, runc } from "./mod.ts";

Deno.test("[runc] echo success command", async function () {
  const res: CommandResult = await runc(
    Deno.env.get("HOME"),
    "echo",
    "Hello Home Directory!\nThis is a second line!",
  );
  console.log("2", res);
  assertEquals(res.code, 0);
  assertEquals(res.decout.length, 3);
  assertEquals(res.decout[0], "Hello Home Directory!");
  assertEquals(res.decout[1], "This is a second line!");
  assertEquals(res.decout[2], "");
  assertEquals(res.decerr.length, 0);
});

Deno.test("[runc] sh/cmd echo error command", async function () {
  try {
    await runc(
      Deno.env.get("HOME"),
      Deno.build.os === "windows" ? "cmd.exe" : "sh",
      Deno.build.os === "windows" ? "/c" : "-c",
      "echo Hello Error >&2 && echo Hello Error 2 >&2 && exit 255",
    );
    assert(false, "Should have thrown a CommandError.");
  } catch (e) {
    if (e instanceof CommandError) {
      const res = e.result;
      assertEquals(res.code, 255);
      assertEquals(res.decout.length, 0);
      assertEquals(res.decerr.length, 3);
      assertEquals(res.decerr[0], "Hello Error");
      assertEquals(res.decerr[1], "Hello Error 2");
      assertEquals(res.decerr[2], "");
    } else {
      throw e;
    }
  }
});
