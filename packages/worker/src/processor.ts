export const processJob = async (jobId: string, payload: unknown) => {
  // console.log(`Processing Job ${jobId}...`);

  await new Promise((resolve) => setTimeout(resolve, 100)); // Fast processing for tests

  if ((payload as Record<string, unknown>)?.fail === true) {
    throw new Error("Deterministic simulated processing failure!");
  }
};
