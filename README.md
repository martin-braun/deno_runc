# runc

Simplified verbose command wrapper for Deno (Terminal) applications.

This wrapper helps to simplify command execution in Deno:

- It pipes the output to the Terminal in real time and awaits command execution and stream buffer unlocking
- It allows to access the full stdout and stderr in raw and decoded format after command execution has finished
- The returned `CommandResult` extends `Deno.CommandOutput`, so exit code, exit signal and more can be read
- A `CommandError` is thrown when the command was not successful, the `CommandResult` can still be retrieved nonetheless.

## Usage

```ts
import {
  runc,
  CommandResult,
  CommandError,
} from "https://deno.land/x/runc/mod.ts";

let result: CommandResult;
try {
  result = await runc(
    Deno.env.get("HOME"), // cwd (default: Deno.cwd())
    "echo",
    "test"
  ); // will also print output to the console.
} catch (e) {
  if (e instanceof CommandError) {
    result = e.result;
  } else {
    throw e;
  }
}

console.log(`exit code: ${result.code}`);
console.log(`decoded stdout: ${result.decout}`); // string[]
console.log(`decoded stderr: ${result.decerr}`); // string[]
```
