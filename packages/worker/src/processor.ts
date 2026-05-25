export const processJob = async (jobId: string, payload: unknown) => {
  // console.log(`Processing Job ${jobId}...`);

  const delay = process.env.NODE_ENV === "test" ? 100 : 3000;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if ((payload as Record<string, unknown>)?.fail === true) {
    throw new Error("Deterministic simulated processing failure!");
  }

  if (process.env.NODE_ENV !== "test" && Math.random() < 0.5) {
    throw new Error("Random simulated processing failure!");
  }
};
