import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/** Skip .DS_Store and other non-directory entries from readdir. */
async function listSubdirsOnly(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const subdirs: string[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    try {
      const info = await stat(full);
      if (info.isDirectory()) subdirs.push(name);
    } catch {
      // skip broken symlinks, etc.
    }
  }
  return subdirs;
}

/** Accept `.../data` or repo root that contains `data/`. */
export async function resolveDataRoot(configured: string): Promise<string> {
  const resolved = path.resolve(configured);
  const hasCongressDir = async (root: string, congress: number) => {
    try {
      await access(path.join(root, String(congress)));
      return true;
    } catch {
      return false;
    }
  };

  if (await hasCongressDir(resolved, 119) || await hasCongressDir(resolved, 118)) {
    return resolved;
  }

  const nested = path.join(resolved, "data");
  try {
    await access(nested);
    return nested;
  } catch {
    return resolved;
  }
}

export async function diagnoseDataLayout(dataRoot: string, congress: number) {
  const votesRoot = path.join(dataRoot, String(congress), "votes");
  const billsRoot = path.join(dataRoot, String(congress), "bills");
  let voteFiles = 0;
  let billFiles = 0;

  for await (const _ of walkVoteFiles(dataRoot, congress)) voteFiles++;
  for await (const _ of walkBillFiles(dataRoot, congress)) billFiles++;

  let votesRootExists = false;
  let billsRootExists = false;
  try {
    await access(votesRoot);
    votesRootExists = true;
  } catch {
    /* missing */
  }
  try {
    await access(billsRoot);
    billsRootExists = true;
  } catch {
    /* missing */
  }

  let sessionYears: string[] = [];
  if (votesRootExists) {
    sessionYears = await listSubdirsOnly(votesRoot);
  }

  return {
    dataRoot,
    congress,
    votesRoot,
    billsRoot,
    votesRootExists,
    billsRootExists,
    sessionYears,
    voteFiles,
    billFiles,
  };
}

export async function* walkVoteFiles(
  dataRoot: string,
  congress: number,
  sessions?: string[],
): AsyncGenerator<string> {
  const votesRoot = path.join(dataRoot, String(congress), "votes");
  const sessionDirs = await listSubdirsOnly(votesRoot);
  if (sessionDirs.length === 0) return;

  for (const session of sessionDirs) {
    if (sessions?.length && !sessions.includes(session)) continue;

    const sessionPath = path.join(votesRoot, session);
    const entries = await listSubdirsOnly(sessionPath);

    for (const entry of entries) {
      const voteDir = path.join(sessionPath, entry);

      const jsonPath = path.join(voteDir, "data.json");
      try {
        await stat(jsonPath);
        yield jsonPath;
      } catch {
        // skip dirs without data.json
      }
    }
  }
}

export async function* walkBillFiles(
  dataRoot: string,
  congress: number,
): AsyncGenerator<string> {
  const billsRoot = path.join(dataRoot, String(congress), "bills");
  const types = await listSubdirsOnly(billsRoot);
  if (types.length === 0) return;

  for (const billType of types) {
    const typePath = path.join(billsRoot, billType);
    const entries = await listSubdirsOnly(typePath);

    for (const entry of entries) {
      const billDir = path.join(typePath, entry);
      const jsonPath = path.join(billDir, "data.json");
      try {
        await stat(jsonPath);
        yield jsonPath;
      } catch {
        // skip
      }
    }
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}
