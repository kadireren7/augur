import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { prepareChamber } from "@/lib/chamber-creation";
import { SqlitePersistence } from "@/lib/database";
import { AugurStore, StoreError } from "@/lib/store";
import type { ChamberCreationInput } from "@/lib/types";

const input: ChamberCreationInput = {
  name: "Nova",
  species: "Hamster",
  description: "Controlled replay Chamber",
  mediaReference: "fixture://nova-path",
  sourceMode: "FIXTURE_REPLAY",
  rulesetTemplate: "ZONE_INVERTED",
  movementThreshold: 0.05,
  confidenceThreshold: 0.8,
  asset: "MON",
  ownerId: "local-owner-12345",
  publisher: "local-owner-12345",
};

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("guarded Chamber creation", () => {
  it("binds a public viewing source and creature metadata to a unique prepared configuration", () => {
    const media = {
      ...input,
      viewingSource: {
        sourceType: "recorded_video" as const,
        sourceUrl: "https://example.org/public.webm",
      },
    };
    const first = prepareChamber(media);
    expect(first.contractConfigHash).not.toBe(
      prepareChamber({ ...media, species: "Fish" }).contractConfigHash,
    );
    expect(first.contractMetadataHash).not.toBe(
      prepareChamber({
        ...media,
        viewingSource: {
          ...media.viewingSource,
          sourceUrl: "https://example.org/other.webm",
        },
      }).contractMetadataHash,
    );
    expect(first.contractConfigHash).toBe(
      prepareChamber(media).contractConfigHash,
    );
    expect(() =>
      prepareChamber({
        ...input,
        viewingSource: {
          sourceType: "browser_camera",
          sourceUrl: "https://example.org/private",
        },
      }),
    ).toThrow();
  });
  it("creates a deterministic constrained Chamber and enforces owner lifecycle", () => {
    const store = new AugurStore(new Date("2026-09-27T12:00:00.000Z"));
    const chamber = store.createChamber(input);
    expect(chamber.status).toBe("DRAFT");
    expect(chamber.rulesetTemplate).toBe("ZONE_INVERTED");
    expect(chamber.latestOmen).toBeNull();
    expect(() =>
      store.setChamberStatus(chamber.slug, "local-stranger-123", "ACTIVE"),
    ).toThrow(StoreError);
    expect(
      store.setChamberStatus(chamber.slug, input.ownerId, "ACTIVE").status,
    ).toBe("ACTIVE");
    expect(() => store.createChamber(input)).toThrow(/already exists/);
  });

  it("rejects executable, remote, oversized, and out-of-range configuration", () => {
    expect(() =>
      prepareChamber({
        ...input,
        mediaReference: "https://private.example/camera",
      }),
    ).toThrow();
    expect(() =>
      prepareChamber({ ...input, mediaReference: "file:///etc/passwd" }),
    ).toThrow();
    expect(() => prepareChamber({ ...input, name: "<script>" })).toThrow();
    expect(() =>
      prepareChamber({ ...input, confidenceThreshold: 0.1 }),
    ).toThrow();
  });

  it("persists created Chambers and social state in SQLite", () => {
    const directory = mkdtempSync(join(tmpdir(), "augur-web-test-"));
    directories.push(directory);
    const path = join(directory, "augur.sqlite3");
    const firstDatabase = new SqlitePersistence(path);
    const first = new AugurStore(
      new Date("2026-09-27T12:00:00.000Z"),
      firstDatabase,
    );
    const chamber = first.createChamber(input);
    first.social.postMessage(
      {
        chamberId: chamber.id,
        sessionId: input.ownerId,
        displayName: "Nova's owner",
        text: "ready",
      },
      1,
    );
    first.social.addReaction(
      { chamberId: chamber.id, sessionId: input.ownerId, reaction: "BUY" },
      2,
    );
    firstDatabase.saveProductRecords(
      chamber.id,
      { name: "Nova", status: "local_demo" },
      { sourceType: "fixture", sourceUrl: null },
    );
    firstDatabase.close();

    const secondDatabase = new SqlitePersistence(path);
    const second = new AugurStore(
      new Date("2026-09-27T12:01:00.000Z"),
      secondDatabase,
    );
    expect(second.getChamber(chamber.slug).id).toBe(chamber.id);
    expect(secondDatabase.loadProductRecord("metadata", chamber.id)).toEqual({
      name: "Nova",
      status: "local_demo",
    });
    expect(secondDatabase.loadProductRecord("media", chamber.id)).toEqual({
      sourceType: "fixture",
      sourceUrl: null,
    });
    expect(second.social.listMessages(chamber.id)[0].text).toBe("ready");
    expect(second.social.getPulse(chamber.id).counts.BUY).toBe(1);
    second.social.postMessage(
      {
        chamberId: chamber.id,
        sessionId: input.ownerId,
        displayName: "Nova's owner",
        text: "again",
      },
      3,
    );
    second.social.addReaction(
      { chamberId: chamber.id, sessionId: input.ownerId, reaction: "BUY" },
      4,
    );
    expect(second.social.listMessages(chamber.id)).toHaveLength(2);
    expect(second.social.getPulse(chamber.id).counts.BUY).toBe(2);
    secondDatabase.close();
  });
});
