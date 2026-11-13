#!/usr/bin/env node

/**
 * server.js — Unified Production Runner
 * 
 * Runs both FastAPI backend (internal port 8000) and Next.js frontend (public port 3000).
 * Next.js serves the UI on / and proxies all /api/*, /docs, /openapi.json, and /health
 * to FastAPI, providing a single seamless URL for the entire application.
 */

const { spawn } = require('child_process');
const path = require('path');

const publicPort = process.env.PORT || '3000';
const backendPort = process.env.BACKEND_PORT || '8000';
const backendHost = process.env.BACKEND_HOST || '127.0.0.1';

console.log('====================================================');
console.log('🚀 Starting Employee Leave Management System');
console.log(`   Frontend (Next.js)  → http://0.0.0.0:${publicPort}`);
console.log(`   API (FastAPI)       → http://${backendHost}:${backendPort}/api`);
console.log(`   Unified URL         → http://0.0.0.0:${publicPort}`);
console.log('====================================================');

const processes = [];
let isShuttingDown = false;

function shutdown(signal = 'SIGTERM') {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}, shutting down processes...`);
  
  for (const proc of processes) {
    if (proc && !proc.killed) {
      try {
        proc.kill('SIGTERM');
      } catch (err) {
        // Process might already be dead
      }
    }
  }

  // Force exit after 5 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('⚠️  Forcefully terminating lingering processes...');
    process.exit(1);
  }, 5000).unref();

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Determine Python binary (in Docker/Linux system python, or venv if present)
const fs = require('fs');
let pythonBin = 'python3';
const venvPython = path.join(__dirname, 'backend', 'venv', 'bin', 'python');
if (fs.existsSync(venvPython)) {
  pythonBin = venvPython;
}

// 1. Launch FastAPI Backend
console.log('📦 [1/2] Launching FastAPI Backend...');
const backendProc = spawn(
  pythonBin,
  ['-m', 'uvicorn', 'app.main:app', '--host', backendHost, '--port', backendPort],
  {
    cwd: path.join(__dirname, 'backend'),
    env: {
      ...process.env,
      BACKEND_HOST: backendHost,
      BACKEND_PORT: backendPort,
    },
    stdio: 'inherit',
  }
);
processes.push(backendProc);

backendProc.on('exit', (code, signal) => {
  if (!isShuttingDown) {
    console.error(`❌ FastAPI backend exited with code ${code || signal}`);
    shutdown(signal || 'EXIT');
  }
});

// Wait briefly for backend to bind, then launch Next.js
setTimeout(() => {
  if (isShuttingDown) return;

  console.log('🌐 [2/2] Launching Next.js Frontend...');
  const frontendDir = path.join(__dirname, 'frontend');

  // Check if standalone or npm start
  const frontendProc = spawn(
    'npx',
    ['next', 'start', '-p', publicPort, '-H', '0.0.0.0'],
    {
      cwd: frontendDir,
      env: {
        ...process.env,
        PORT: publicPort,
        BACKEND_URL: `http://${backendHost}:${backendPort}`,
      },
      stdio: 'inherit',
    }
  );
  processes.push(frontendProc);

  frontendProc.on('exit', (code, signal) => {
    if (!isShuttingDown) {
      console.error(`❌ Next.js frontend exited with code ${code || signal}`);
      shutdown(signal || 'EXIT');
    }
  });
}, 1000);

