export const processJob = async (jobId: string, payload: any) => {
  console.log(`Processing Job ${jobId}...`);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (Math.random() < 0.5) {
    throw new Error("Random simulated processing failure!");
  }
};
