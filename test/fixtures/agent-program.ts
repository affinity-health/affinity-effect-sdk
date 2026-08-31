import type { AgentProgram } from "../../src/code/index.ts";

const program: AgentProgram = async ({ operations }) => ({
  operationCount: Object.keys(operations).length,
});

export default program;
