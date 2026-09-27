import { createHash } from "node:crypto";

import { z } from "zod";

import type { ChamberCreationInput, OmenValue } from "@/lib/types";

const localIdentity = /^local-[a-zA-Z0-9-]{8,100}$/;
const address = /^0x[0-9a-fA-F]{40}$/;
const mediaReference = /^(fixture|upload|webcam):\/\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export const chamberCreationSchema = z.object({
  name: z.string().trim().min(1).max(48).regex(/^[\p{L}\p{N}][\p{L}\p{N} .'-]*$/u),
  species: z.enum(["Hamster", "Fish", "Turtle"]),
  description: z.string().trim().max(280).optional().default(""),
  mediaReference: z.string().trim().max(160).regex(mediaReference),
  sourceMode: z.enum(["FIXTURE_REPLAY", "UPLOADED_CLIP", "LIVE_ADAPTER"]),
  rulesetTemplate: z.enum(["ZONE_STANDARD", "ZONE_INVERTED", "DIRECTIONAL"]),
  movementThreshold: z.number().min(0.001).max(1),
  confidenceThreshold: z.number().min(0.5).max(1),
  asset: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/),
  ownerId: z.string().refine((value) => address.test(value) || localIdentity.test(value)),
  publisher: z.string().refine((value) => address.test(value) || localIdentity.test(value)),
}).superRefine((value, context) => {
  const expectedScheme = {
    FIXTURE_REPLAY: "fixture://",
    UPLOADED_CLIP: "upload://",
    LIVE_ADAPTER: "webcam://",
  }[value.sourceMode];
  if (!value.mediaReference.startsWith(expectedScheme)) {
    context.addIssue({
      code: "custom",
      path: ["mediaReference"],
      message: `source mode requires a ${expectedScheme} reference`,
    });
  }
});

export const RULESET_MAPPINGS: Record<
  ChamberCreationInput["rulesetTemplate"],
  Record<string, OmenValue>
> = {
  ZONE_STANDARD: { LEFT: "SELL", CENTER: "HOLD", RIGHT: "BUY" },
  ZONE_INVERTED: { LEFT: "BUY", CENTER: "HOLD", RIGHT: "SELL" },
  DIRECTIONAL: { LEFT: "SELL", STATIONARY: "HOLD", RIGHT: "BUY" },
};

function canonical(value: Record<string, unknown>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
}

export function prepareChamber(input: unknown) {
  const value = chamberCreationSchema.parse(input);
  const rules = {
    confidenceThreshold: value.confidenceThreshold,
    mapping: RULESET_MAPPINGS[value.rulesetTemplate],
    movementThreshold: value.movementThreshold,
    template: value.rulesetTemplate,
    version: "1.0.0",
  };
  const metadata = {
    description: value.description,
    mediaReference: value.mediaReference,
    name: value.name,
    ownerId: value.ownerId,
    species: value.species,
  };
  const digest = (payload: Record<string, unknown>) =>
    createHash("sha256").update(canonical(payload)).digest("hex");
  const metadataHash = digest(metadata);
  const rulesetHash = digest(rules);
  const configHash = digest({
    asset: value.asset,
    mediaReference: value.mediaReference,
    rulesetHash,
    sourceMode: value.sourceMode,
  });
  return {
    value,
    metadata,
    rules,
    metadataHash,
    rulesetHash,
    configHash,
    creatureId: `creature-${metadataHash.slice(0, 16)}`,
    chamberId: `chamber-${configHash.slice(0, 16)}`,
    contractCreatureId: `0x${metadataHash}` as `0x${string}`,
    contractChamberId: `0x${configHash}` as `0x${string}`,
    contractMetadataHash: `0x${metadataHash}` as `0x${string}`,
    contractRulesetHash: `0x${rulesetHash}` as `0x${string}`,
    contractConfigHash: `0x${configHash}` as `0x${string}`,
    slug: `${value.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${configHash.slice(0, 6)}`,
  };
}
