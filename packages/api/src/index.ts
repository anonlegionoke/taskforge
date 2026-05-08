// Express server
import './config';
import express from 'express';
import { getChannel, initRabbitMQ, pool } from '@taskforge/shared';


const app = express();
app.use(express.json());

const PORT = process.env.API_SERVER_PORT || 3000;

const MAIN_QUEUE = 'taskforge.queue.jobs';

// POST /jobs
app.post('/jobs', async (req, res) => {
    const { type, payload } = req.body;

    if (!type) {
        return res.status(400).json({ error: 'Job "type" is required.' });
    }

    try {
        const dbResult = await pool.query(`INSERT INTO jobs (type, payload, status) VALUES ($1, $2, PENDING) RETURNING id`, [type, payload || {}]);

        const jobId = dbResult.rows[0].id;

        const channel = getChannel();

        channel.sendToQueue(MAIN_QUEUE, Buffer.from(JSON.stringify({ jobId })), { persistent: true });

        console.log('SUCCESS: Job ingested: ', jobId);

        return res.status(202).json({ message: 'Job accepted for processing', jobId });

    } catch (error) {
        console.error('Error ingesting job: ', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Boot Sequence
const startServer = async () => {
    try {
        console.log('Starting Taskforge API Server...');

        // Test DB
        await pool.query('SELECT 1');
        console.log('SUCCESS: DB connected.');

        // Initialize RabbitMQ
        await initRabbitMQ();

        app.listen(PORT, () => {
            console.log('SUCCESS: Taskforge API listening on port:', PORT);
        });

    } catch (error) {
        console.error('FAILED: Fatal error during startup', error);
        process.exit(1);
    }
};

startServer();
