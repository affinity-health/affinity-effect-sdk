import { Effect } from "effect";
import { layer, updatePatient } from "@affinity-health/effect-sdk";

const program = updatePatient({
  practiceId: "prac_example",
  patientId: "pat_example",
  name: {
    first: "Jane",
    last: "Doe",
  },
});

const patient = await Effect.runPromise(
  program.pipe(
    Effect.provide(
      layer({
        apiKey: process.env.AFFINITY_API_KEY!,
      }),
    ),
  ),
);

console.log(patient);
