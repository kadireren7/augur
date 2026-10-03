import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";
import { z } from "zod";

const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "expected bytes32 hex");
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "expected EVM address");

export const omenRequestSchema = z.object({
  workflow_version: z.literal("1.0.0"),
  schema_version: z.literal("1.0.0"),
  manifest_hash: bytes32,
  chamber_id: bytes32,
  creature_id: bytes32,
  sequence: z.number().int().positive(),
  previous_sequence: z.number().int().nonnegative(),
  provenance_hash: bytes32,
  publication_state: z.literal("PENDING"),
  omen_value: z.enum(["SELL", "HOLD", "BUY"]),
  behavior_type: z.enum([
    "ZONE_OCCUPANCY",
    "ZONE_ENTRY",
    "ZONE_EXIT",
    "DIRECTIONAL_MOVEMENT",
    "INACTIVITY",
  ]),
  observed_at: z.number().int().positive(),
  ruleset_version: z.string().min(1),
  ruleset_hash: bytes32,
  chain_id: z.literal(10143),
  omen_publisher: address,
}).strict();

export type OmenRequest = z.infer<typeof omenRequestSchema>;

export interface WorkflowConfig {
  workflowId: "augur-omen-validation-v1";
  workflowVersion: "1.0.0";
  chainId: 10143;
  omenPublisher: Address;
}

export interface OmenDecision {
  accepted: true;
  decision_id: Hex;
  execution_id: Hex;
  workflow_id: "augur-omen-validation-v1";
  workflow_version: "1.0.0";
  manifest_hash: Hex;
  chamber_id: Hex;
  creature_id: Hex;
  sequence: number;
  provenance_hash: Hex;
  publication: {
    chain_id: 10143;
    to: Address;
    method: "publish(bytes32,bytes32,uint64,uint8,uint8,uint64,bytes32,bytes32)";
    data: Hex;
    value: "0";
  };
}

export const omenPublisherAbi = [{
  type: "function",
  name: "publish",
  stateMutability: "nonpayable",
  inputs: [
    { name: "chamberId", type: "bytes32" },
    { name: "creatureId", type: "bytes32" },
    { name: "sequence", type: "uint64" },
    { name: "omenType", type: "uint8" },
    { name: "behaviorType", type: "uint8" },
    { name: "observedAt", type: "uint64" },
    { name: "rulesetHash", type: "bytes32" },
    { name: "provenanceHash", type: "bytes32" },
  ],
  outputs: [],
}] as const;

const omenIndex = { SELL: 0, HOLD: 1, BUY: 2 } as const;
const behaviorIndex = {
  ZONE_OCCUPANCY: 0,
  ZONE_ENTRY: 1,
  ZONE_EXIT: 2,
  DIRECTIONAL_MOVEMENT: 3,
  INACTIVITY: 4,
} as const;

export function validateAndPrepareOmenPublication(
  value: unknown,
  config: WorkflowConfig,
): OmenDecision {
  const request = omenRequestSchema.parse(value);
  if (request.workflow_version !== config.workflowVersion) {
    throw new Error("workflow version mismatch");
  }
  if (request.chain_id !== config.chainId) throw new Error("Monad chain mismatch");
  if (request.omen_publisher.toLowerCase() !== config.omenPublisher.toLowerCase()) {
    throw new Error("OmenPublisher target mismatch");
  }
  if (request.manifest_hash.toLowerCase() !== request.provenance_hash.toLowerCase()) {
    throw new Error("manifest/provenance commitment mismatch");
  }
  if (request.sequence <= request.previous_sequence) {
    throw new Error("sequence replay or regression");
  }

  const omenType = omenIndex[request.omen_value];
  const behaviorType = behaviorIndex[request.behavior_type];
  const data = encodeFunctionData({
    abi: omenPublisherAbi,
    functionName: "publish",
    args: [
      request.chamber_id as Hex,
      request.creature_id as Hex,
      BigInt(request.sequence),
      omenType,
      behaviorType,
      BigInt(request.observed_at),
      request.ruleset_hash as Hex,
      request.provenance_hash as Hex,
    ],
  });
  const decisionId = keccak256(encodeAbiParameters(
    parseAbiParameters(
      "string workflowVersion, bytes32 manifestHash, bytes32 chamberId, bytes32 creatureId, uint64 sequence, uint8 omenType, uint8 behaviorType, uint64 observedAt, bytes32 rulesetHash, bytes32 provenanceHash, uint256 chainId, address omenPublisher",
    ),
    [
      request.workflow_version,
      request.manifest_hash as Hex,
      request.chamber_id as Hex,
      request.creature_id as Hex,
      BigInt(request.sequence),
      omenType,
      behaviorType,
      BigInt(request.observed_at),
      request.ruleset_hash as Hex,
      request.provenance_hash as Hex,
      BigInt(request.chain_id),
      request.omen_publisher as Address,
    ],
  ));

  return {
    accepted: true,
    decision_id: decisionId,
    execution_id: decisionId,
    workflow_id: config.workflowId,
    workflow_version: request.workflow_version,
    manifest_hash: request.manifest_hash as Hex,
    chamber_id: request.chamber_id as Hex,
    creature_id: request.creature_id as Hex,
    sequence: request.sequence,
    provenance_hash: request.provenance_hash as Hex,
    publication: {
      chain_id: request.chain_id,
      to: config.omenPublisher,
      method: "publish(bytes32,bytes32,uint64,uint8,uint8,uint64,bytes32,bytes32)",
      data,
      value: "0",
    },
  };
}

export function parseAndPrepareOmenPublication(
  payload: Uint8Array,
  config: WorkflowConfig,
): OmenDecision {
  if (payload.length === 0) throw new Error("malformed payload: empty input");
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(payload).toString("utf8"));
  } catch {
    throw new Error("malformed payload: invalid JSON");
  }
  return validateAndPrepareOmenPublication(value, config);
}
