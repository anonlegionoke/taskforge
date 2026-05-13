import { connect, type Channel, type ChannelModel } from "amqplib";

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let initialization: Promise<{ channel: Channel; connection: ChannelModel }> | null = null;

const dlx = "taskforge.dlx";
const dlq = "taskforge.queue.dlq";
const mainQueue = "taskforge.queue.jobs";

const clearConnectionState = (conn?: ChannelModel, ch?: Channel) => {
  if (!conn || connection === conn) {
    connection = null;
  }

  if (!ch || channel === ch) {
    channel = null;
  }
};

const clearChannelState = (ch: Channel) => {
  if (channel === ch) {
    channel = null;
  }
};

export const initRabbitMQ = async (): Promise<{ channel: Channel; connection: ChannelModel }> => {
  if (channel && connection) return { channel, connection };
  if (initialization) return initialization;

  initialization = connectRabbitMQ();

  try {
    return await initialization;
  } finally {
    initialization = null;
  }
};

const connectRabbitMQ = async (): Promise<{ channel: Channel; connection: ChannelModel }> => {
  try {
    const rabbitMQUrl = process.env.RABBITMQ_URL;

    if (!rabbitMQUrl) {
      throw new Error("FATAL: RABBITMQ_URL environment variable is missing.");
    }

    const conn = await connect(rabbitMQUrl);
    const ch = await conn.createChannel();

    await ch.prefetch(1);

    // Dead Letter Exchange & Dead Queue
    await ch.assertExchange(dlx, "direct", { durable: true });
    await ch.assertQueue(dlq, { durable: true });
    await ch.bindQueue(dlq, dlx, "dead_letter");

    // Main Queue
    await ch.assertQueue(mainQueue, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": dlx,
        "x-dead-letter-routing-key": "dead_letter",
      },
    });

    connection = conn;
    channel = ch;

    conn.on("error", (err) => {
      console.error("RabbitMQ connection error", err);
    });

    conn.on("close", () => {
      clearConnectionState(conn, ch);
      console.error("RabbitMQ connection closed. Call initRabbitMQ() to reconnect.");
    });

    ch.on("error", (err) => {
      console.error("RabbitMQ channel error", err);
    });

    ch.on("close", () => {
      clearChannelState(ch);
      console.error("RabbitMQ channel closed.");
    });

    console.log("SUCCESS: RabbitMQ connected and queue initialized");

    return { channel: ch, connection: conn };
  } catch (error) {
    console.error("Failed to connect to RabbitMQ: ", error);
    clearConnectionState();
    throw error;
  }
};

export const getChannel = (): Channel => {
  if (!channel) throw new Error("RabbitMQ channel is not initialized");
  return channel;
};

export const getConnection = (): ChannelModel => {
  if (!connection) throw new Error("RabbitMQ connection is not initialized");
  return connection;
};
