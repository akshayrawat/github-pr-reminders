import { describe, it, expect } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readUsersMap } from "./config";

async function writeTempFile(contents: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "pr-reminders-"));
  const filePath = path.join(dir, "users.json");
  await writeFile(filePath, contents, "utf8");
  return filePath;
}

describe("readUsersMap", () => {
  it("loads a valid users map", async () => {
    const filePath = await writeTempFile(JSON.stringify({ alice: "U01ALICE" }));
    const map = await readUsersMap(filePath);
    expect(map.alice).toBe("U01ALICE");
  });

  it("throws for invalid JSON", async () => {
    const filePath = await writeTempFile("{ invalid json");
    await expect(readUsersMap(filePath)).rejects.toThrow("not valid JSON");
  });

  it("throws when values are not strings", async () => {
    const filePath = await writeTempFile(JSON.stringify({ alice: 123 }));
    await expect(readUsersMap(filePath)).rejects.toThrow("must be a string");
  });
});
