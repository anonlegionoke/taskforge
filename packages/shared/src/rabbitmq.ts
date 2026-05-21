import { connect, type ChannelModel, type ConfirmChannel } from "amqplib";
import { SystemLogger } from "./logger";

const logger = new SystemLogger("RABBITMQ");

let connection: ChannelModel | null = null;
let channel: ConfirmChannel | null = null;
let initialization: Promise<{ channel: ConfirmChannel; connection: ChannelModel }> | null = null;

const dlx = "taskforge.dlx";
const dlq = "taskforge.queue.dlq";
const mainQueue = "taskforge.queue.jobs";

const clearConnectionState = (conn?: ChannelModel, ch?: ConfirmChannel) => {
  if (!conn || connection === conn) {
    connection = null;
  }

  if (!ch || channel === ch) {
    channel = null;
  }
};

const clearChannelState = (ch: ConfirmChannel) => {
  if (channel === ch) {
    channel = null;
  }
};

export const initRabbitMQ = async (): Promise<{ channel: ConfirmChannel; connection: ChannelModel }> => {
  if (channel && connection) return { channel, connection };
  if (initialization) return initialization;

  initialization = connectRabbitMQ();

  try {
    return await initialization;
  } finally {
    initialization = null;
  }
};

const connectRabbitMQ = async (): Promise<{ channel: ConfirmChannel; connection: ChannelModel }> => {
  try {
    const rabbitMQUrl = process.env.RABBITMQ_URL;

    if (!rabbitMQUrl) {
      throw new Error("FATAL: RABBITMQ_URL environment variable is missing.");
    }

    const conn = await connect(rabbitMQUrl);
    const ch = await conn.createConfirmChannel();

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
      logger.error("RabbitMQ connection error", err);
    });

    conn.on("close", () => {
      clearConnectionState(conn, ch);
      logger.error("RabbitMQ connection closed. Call initRabbitMQ() to reconnect.");
    });

    ch.on("error", (err) => {
      logger.error("RabbitMQ channel error", err);
    });

    ch.on("close", () => {
      clearChannelState(ch);
      logger.error("RabbitMQ channel closed.");
    });

    logger.info("SUCCESS: RabbitMQ connected and queue initialized");

    return { channel: ch, connection: conn };
  } catch (error) {
    logger.error("Failed to connect to RabbitMQ: ", error);
    clearConnectionState();
    throw error;
  }
};

export const getChannel = (): ConfirmChannel => {
  if (!channel) throw new Error("RabbitMQ channel is not initialized");
  return channel;
};

export const getConnection = (): ChannelModel => {
  if (!connection) throw new Error("RabbitMQ connection is not initialized");
  return connection;
};
