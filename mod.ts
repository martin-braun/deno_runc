// Copyright 2023 Martin Braun. All rights reserved. MIT license.

import { fs } from "./deps.ts";

export class CommandError extends Error {
  result: CommandResult;
  constructor(message: string, result: CommandResult, options?: ErrorOptions) {
    super(message, options);
    this.result = result;
  }
}

export interface CommandResult extends Deno.CommandOutput {
  /** The decoded buffered standart and error output line array from the child process. */
  lines: string[];
}

function getWritableStream(
  name: string,
  decoder: TextDecoder,
  encoder: TextEncoder,
  outChunks: Uint8Array[],
  outLines: string[],
  eol: string = fs.EOL,
): WritableStream<Uint8Array> {
  let fchunk = true;
  return new WritableStream({
    async write(chunk: Uint8Array): Promise<void> {
      outChunks.push(chunk);
      if (outLines.length < 1) {
        await Deno.stdout.write(
          encoder.encode(`${!fchunk ? eol : ""}[${name}] `)
        );
      }
      const lines: string[] = decoder.decode(chunk).split(/\r?\n/);
      if (lines.length > 0) {
        await Deno.stdout.write(encoder.encode(lines[0]));
        outLines.push(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          await Deno.stdout.write(
            encoder.encode(`${eol}[${name}] ${lines[i]}`),
          );
          outLines.push(lines[i]);
        }
      }
      fchunk = false;
    },
  });
}

export async function runc(
  cwd: string | null | undefined,
  ...cmd: string[]
): Promise<CommandResult> {
  cwd = cwd || Deno.cwd();

  const decoder: TextDecoder = new TextDecoder();
  const encoder: TextEncoder = new TextEncoder();
  const chkout: Uint8Array[] = [];
  const chkerr: Uint8Array[] = [];
  const lines: string[] = [];
  const eol: string = fs.EOL;

  const wsout: WritableStream<Uint8Array> = getWritableStream(
    cmd[0],
    decoder,
    encoder,
    chkout,
    lines,
    eol,
  );
  const wserr: WritableStream<Uint8Array> = getWritableStream(
    cmd[0],
    decoder,
    encoder,
    chkerr,
    lines,
    eol,
  );

  const cmdstr = cmd.reduce(
    (a, b) =>
      a +
      " " +
      (b.indexOf(" ") >= 0 || b.indexOf('"') >= 0 || b.indexOf("'") >= 0
        ? `"${b.replaceAll('"', Deno.build.os === "windows" ? `^"` : `"'"'"`)}"`
        : b),
  );
  console.log(`${cwd || ""}$ ${cmdstr}`);
  const c = new Deno.Command(cmd[0], {
    cwd,
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  });
  const p: Deno.ChildProcess = c.spawn();

  p.stdout.pipeTo(wsout);
  p.stderr.pipeTo(wserr);

  const status: Deno.CommandStatus = await p.status;
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (!wsout.locked && !wserr.locked) break;
  }

  // serialize chunks for the command result:
  let offs: number;
  const stdout = new Uint8Array(
    chkout.reduce((len: number, arr: Uint8Array) => len + arr.byteLength, 0),
  );
  offs = 0;
  for (const chunk of chkout) {
    stdout.set(chunk, offs);
    offs += chunk.byteLength;
  }
  const stderr = new Uint8Array(
    chkerr.reduce((len: number, arr: Uint8Array) => len + arr.byteLength, 0),
  );
  offs = 0;
  for (const chunk of chkerr) {
    stderr.set(chunk, offs);
    offs += chunk.byteLength;
  }

  // insert line feed
  if (lines.length > 0 && lines[lines.length - 1].length == 0) {
    await Deno.stdout.write(encoder.encode(eol));
  }

  const res: CommandResult = {
    ...status,
    stdout,
    stderr,
    lines,
  };

  if (!res.success) {
    throw new CommandError(
      `[${cmd[0]}] failed with exit code ${res.code}`,
      res,
    );
  }

  return res;
}
