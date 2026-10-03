import {
  cre,
  Runner,
  type HTTPPayload,
  type Runtime,
} from "@chainlink/cre-sdk";

import {
  parseAndPrepareOmenPublication,
  type WorkflowConfig,
} from "./validation";

const onOmenRequest = (runtime: Runtime<WorkflowConfig>, payload: HTTPPayload): string => {
  const decision = parseAndPrepareOmenPublication(payload.input, runtime.config);
  runtime.log(JSON.stringify({
    accepted: decision.accepted,
    decisionId: decision.decision_id,
    chamberId: decision.chamber_id,
    sequence: decision.sequence,
    chainId: decision.publication.chain_id,
    target: decision.publication.to,
  }));
  return JSON.stringify(decision);
};

const initWorkflow = (_config: WorkflowConfig) => {
  const httpTrigger = new cre.capabilities.HTTPCapability();
  return [cre.handler(httpTrigger.trigger({}), onOmenRequest)];
};

export async function main() {
  const runner = await Runner.newRunner<WorkflowConfig>();
  await runner.run(initWorkflow);
}

main();
