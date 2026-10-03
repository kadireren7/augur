import { describe, expect, test } from "bun:test";
import { decodeFunctionData } from "viem";

import validPayload from "./payloads/monad-smoke-omen.json";
import {
  omenPublisherAbi,
  parseAndPrepareOmenPublication,
  validateAndPrepareOmenPublication,
  type WorkflowConfig,
} from "./validation";

const config: WorkflowConfig = {
  workflowId: "augur-omen-validation-v1",
  workflowVersion: "1.0.0",
  chainId: 10143,
  omenPublisher: "0x333c7ba28b6Eec62f51d111d161fc52fd3ADAa1a",
};

describe("Augur CRE Omen workflow", () => {
  test("accepts the real Monad smoke-shaped Omen and deterministically prepares publication", () => {
    const first = validateAndPrepareOmenPublication(validPayload, config);
    const second = validateAndPrepareOmenPublication(validPayload, config);
    expect(second).toEqual(first);
    expect(first.accepted).toBe(true);
    expect(first.publication.chain_id).toBe(10143);
    expect(first.publication.to).toBe(config.omenPublisher);

    const decoded = decodeFunctionData({ abi: omenPublisherAbi, data: first.publication.data });
    expect(decoded.functionName).toBe("publish");
    expect(decoded.args).toEqual([
      validPayload.chamber_id as `0x${string}`,
      validPayload.creature_id as `0x${string}`,
      1n,
      2,
      1,
      1790954252n,
      validPayload.ruleset_hash as `0x${string}`,
      validPayload.provenance_hash as `0x${string}`,
    ]);
  });

  test("serializes and parses an HTTP request without changing its decision", () => {
    const serialized = Buffer.from(JSON.stringify(validPayload));
    expect(parseAndPrepareOmenPublication(serialized, config)).toEqual(
      validateAndPrepareOmenPublication(validPayload, config),
    );
  });

  test("rejects missing Chamber and missing provenance commitment", () => {
    const { chamber_id: _chamberId, ...missingChamber } = validPayload;
    const { provenance_hash: _provenanceHash, ...missingProvenance } = validPayload;
    expect(() => validateAndPrepareOmenPublication(missingChamber, config)).toThrow();
    expect(() => validateAndPrepareOmenPublication(missingProvenance, config)).toThrow();
  });

  test("rejects invalid or replayed sequences", () => {
    expect(() => validateAndPrepareOmenPublication({ ...validPayload, sequence: 0 }, config)).toThrow();
    expect(() => validateAndPrepareOmenPublication({
      ...validPayload,
      previous_sequence: validPayload.sequence,
    }, config)).toThrow("sequence replay or regression");
  });

  test("rejects unsupported Omen values and malformed JSON", () => {
    expect(() => validateAndPrepareOmenPublication({ ...validPayload, omen_value: "MOON" }, config)).toThrow();
    expect(() => parseAndPrepareOmenPublication(Buffer.from("{"), config)).toThrow(
      "malformed payload: invalid JSON",
    );
  });

  test("rejects unbound commitments and non-Monad publication targets", () => {
    expect(() => validateAndPrepareOmenPublication({
      ...validPayload,
      manifest_hash: `0x${"1".repeat(64)}`,
    }, config)).toThrow("manifest/provenance commitment mismatch");
    expect(() => validateAndPrepareOmenPublication({
      ...validPayload,
      omen_publisher: "0x0000000000000000000000000000000000000001",
    }, config)).toThrow("OmenPublisher target mismatch");
    expect(() => validateAndPrepareOmenPublication({ ...validPayload, chain_id: 1 }, config)).toThrow();
  });
});
