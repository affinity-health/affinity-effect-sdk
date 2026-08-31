import type { AgentProgram } from "@affinity-health/effect-sdk/code";

const program: AgentProgram = async ({ affinity, log }) => {
  log("Reading the first ten practices");
  return affinity.listPractices({ limit: 10 });
};

export default program;
