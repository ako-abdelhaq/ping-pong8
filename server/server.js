const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const express = require('express');
const app = express();

// Read the environment variable injected from ConfigMap
const envMessage = process.env.MESSAGE || 'Default message (env not found)';

// Define the exact path where Kubernetes mounts the file
const configFilePath = path.join('/log-api/config', 'information.txt');

const PingPong_URL = process.env.PingPong_URL || 'http://ako-ping-pong-svc:1238';

// Store the latest log state in memory
let lastTimestamp = null;
let totalLogs = 0;

// Generate a random string (UUID) on startup and store it in memory
const randomString = crypto.randomUUID();

function printLog() {
  // Generate the current timestamp in ISO 8601 format
  lastTimestamp = new Date().toISOString();
  totalLogs++;
  console.log(`${lastTimestamp}: ${randomString}`);
}

// Optional: Output immediately on startup so you don't have to wait 5 seconds
printLog();


// Output the string every 5 seconds (5000 milliseconds)
setInterval(printLog, 5000);


// Respond to GET requests on the root URL
app.get('/health', (req, res) => {
  res.send("Hello! Ako's logger API v4 is running.");
});

// Health check
app.get('/healthz', async (req, res) => {
  console.log("Trying to probe ping-pong on /healthz")

  try {
    // Abort after 1.5s so we respond BEFORE Kubernetes' 3s timeoutSeconds
    const response = await fetch(`${PingPong_URL}/healthz`, {
      signal: AbortSignal.timeout(1500),
    });
    if (response.ok) {
      return res.status(200).send('OK');
    }

    return res.status(500).send('Ping-pong returned error');
  } catch (err) {
    return res.status(500).send('Cannot reach ping-pong service');
  }

});

// HTTP endpoint returning JSON status
app.get('/log-status', (req, res) => {
  res.json({
    status: 'running',
    randomString: randomString,
    lastTimestamp: lastTimestamp,
    latestLog: `${lastTimestamp}: ${randomString}`,
    totalLogs: totalLogs
  });
});

// Optional: Plain-text endpoint if you just want the formatted log line
app.get('/log-one-line', (req, res) => {
  res.type('text/plain').send(`${lastTimestamp}: ${randomString}`);
});

// HTTP endpoint returning pong status
app.get('/', async (req, res) => {

  const response = await fetch(`${PingPong_URL}/pings`, {
    signal: AbortSignal.timeout(3000), // 3-second timeout
  });

  if (!response.ok) {
    return res.status(response.status).json({ error: 'Service B returned an error' });
  }

  const ping_pong_data = await response.json();

  const { pong } = ping_pong_data;

  let fileContent = 'File not found';

  try {
    // Reading inside the route handler allows live updates if the ConfigMap changes
    fileContent = fs.readFileSync(configFilePath, 'utf8');
  } catch (err) {
    console.error(`Error reading config file at ${configFilePath}:`, err.message);
  }

  res.json({
    status: 'running',
    randomString: randomString,
    lastTimestamp: lastTimestamp,
    latestLog: `${lastTimestamp}: ${randomString}`,
    totalLogs: totalLogs,
    "Ping / Pong": pong,
    "file content": fileContent.trim(),
    "env variable": `MESSAGE=${envMessage}`
  });
});

// Listen on port 8080 and output the requested message
app.listen(8080, () => {
  console.log('Server started in port 8080');
});
