#!/usr/bin/env node
/**
 * 100-user load simulation for the Samha CRM API.
 *
 * Self-contained (Node 18+, zero deps). Simulates 100 concurrent virtual users
 * over a configurable run duration, each picking a weighted user profile
 * (sales-agent / manager / admin / viewer) and exercising the routes that
 * profile actually hits in real usage.
 *
 * Usage:
 *   API_BASE=http://localhost:3000 \
 *   AUTH_TOKEN=... \
 *   DURATION_SEC=60 \
 *   USERS=100 \
 *   node tools/load-test/simulate-100-users.mjs
 *
 * If AUTH_TOKEN is unset, the run uses ALLOW_MOCK_AUTH=true expectations
 * (the dev-user-1 path) — only useful against a local instance.
 *
 * Output: per-route p50/p95/p99 latency, error rate, total RPS. Writes a JSON
 * summary to load-test-results.json on completion.
 */

import http from "node:http";
import https from "node:https";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs/promises";

const API_BASE = process.env.API_BASE || "http://localhost:3000";
const DURATION_SEC = parseInt(process.env.DURATION_SEC || "60", 10);
const USERS = parseInt(process.env.USERS || "100", 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const isHttps = API_BASE.startsWith("https://");
const httpLib = isHttps ? https : http;
const agent = new httpLib.Agent({ keepAlive: true, maxSockets: 200 });

// ── User profiles ────────────────────────────────────────────────────────
// Weights match a typical real-estate sales team breakdown.
const PROFILES = [
  { name: "agent", weight: 60, flow: agentFlow }, // 60 sales agents
  { name: "manager", weight: 25, flow: managerFlow }, // 25 managers
  { name: "admin", weight: 10, flow: adminFlow }, // 10 admins
  { name: "viewer", weight: 5, flow: viewerFlow }, // 5 read-only / interns
];

function pickProfile() {
  const total = PROFILES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of PROFILES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PROFILES[0];
}

// ── HTTP helper ──────────────────────────────────────────────────────────
const stats = new Map(); // route → { samples: number[], errors: number }

function recordSample(route, durationMs, status) {
  let s = stats.get(route);
  if (!s) {
    s = { samples: [], errors: 0, statusCounts: {} };
    stats.set(route, s);
  }
  s.samples.push(durationMs);
  s.statusCounts[status] = (s.statusCounts[status] || 0) + 1;
  if (status >= 500 || status === 0) s.errors += 1;
}

function request(method, path, body, label) {
  return new Promise((resolve) => {
    const url = new URL(API_BASE + path);
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      agent,
    };
    if (AUTH_TOKEN) opts.headers.Authorization = `Bearer ${AUTH_TOKEN}`;

    const start = performance.now();
    const req = httpLib.request(url, opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const durationMs = performance.now() - start;
        recordSample(label || `${method} ${path}`, durationMs, res.statusCode);
        let parsed = null;
        try {
          parsed = data ? JSON.parse(data) : null;
        } catch {}
        resolve({ status: res.statusCode, body: parsed, durationMs });
      });
    });
    req.on("error", (err) => {
      const durationMs = performance.now() - start;
      recordSample(label || `${method} ${path}`, durationMs, 0);
      resolve({ status: 0, body: null, durationMs, error: err.message });
    });
    req.setTimeout(15000, () => {
      req.destroy(new Error("timeout"));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Realistic per-profile flows ──────────────────────────────────────────
// Each flow is one "session loop". Returns when the user has done one round
// of typical activity (~2-5 requests). Drivers run flows back-to-back with
// short think-times for the duration of the test.

async function agentFlow() {
  // Sales agent: open My Day → list leads → open one → log activity → search.
  await request("GET", "/api/leads?stage=NEW&limit=20", null, "GET /api/leads (list)");
  await sleep(200 + Math.random() * 800); // think time

  const list = await request("GET", "/api/leads?limit=10", null, "GET /api/leads (sample)");
  if (list.status === 200 && Array.isArray(list.body?.data) && list.body.data.length > 0) {
    const id = list.body.data[Math.floor(Math.random() * list.body.data.length)].id;
    await request("GET", `/api/leads/${id}`, null, "GET /api/leads/:id");
    await sleep(500 + Math.random() * 2000);

    // 30% of the time, log an activity
    if (Math.random() < 0.3) {
      await request(
        "POST",
        `/api/leads/${id}/activities`,
        {
          type: "CALL",
          summary: "[load-test] simulated call",
          outcome: "no_answer",
        },
        "POST /api/leads/:id/activities"
      );
    }
  }

  // 20% of the time: search
  if (Math.random() < 0.2) {
    const q = ["mohamed", "sara", "ali", "+9715"][Math.floor(Math.random() * 4)];
    await request("GET", `/api/leads?search=${encodeURIComponent(q)}&limit=20`, null, "GET /api/leads (search)");
  }
}

async function managerFlow() {
  // Manager: dashboard heavy. Reports, finance, broker dashboard, agent leaderboard.
  await request("GET", "/api/reports/pipeline", null, "GET /api/reports/pipeline");
  await sleep(300);
  await request("GET", "/api/finance/dashboard", null, "GET /api/finance/dashboard");
  await sleep(500);
  await request("GET", "/api/deals?limit=50", null, "GET /api/deals (list)");
  await sleep(300);
  await request("GET", "/api/broker-dashboard/summary", null, "GET /api/broker-dashboard/summary");
  await sleep(1000 + Math.random() * 2000);
}

async function adminFlow() {
  // Admin: user management + audit log + settings, plus occasional delete.
  await request("GET", "/api/users?limit=50", null, "GET /api/users (list)");
  await sleep(400);
  await request("GET", "/api/settings", null, "GET /api/settings");
  await sleep(300);
  await request("GET", "/api/brokers/companies", null, "GET /api/brokers/companies");
  await sleep(800 + Math.random() * 2000);
}

async function viewerFlow() {
  // Viewer: read-only browsing.
  await request("GET", "/api/projects?limit=20", null, "GET /api/projects");
  await sleep(500);
  await request("GET", "/api/units?limit=50", null, "GET /api/units");
  await sleep(2000 + Math.random() * 3000);
}

// ── Driver ───────────────────────────────────────────────────────────────
async function runVirtualUser(userId, endTime) {
  const profile = pickProfile();
  while (performance.now() < endTime) {
    try {
      await profile.flow();
    } catch (err) {
      console.error(`[user ${userId}] flow error:`, err.message);
    }
    await sleep(500 + Math.random() * 1500); // between-flow think time
  }
}

async function probeHealth() {
  const { status, durationMs } = await request("GET", "/health", null, "GET /health");
  if (status !== 200) {
    console.error(`Health check failed (status=${status}). Is the API running at ${API_BASE}?`);
    process.exit(2);
  }
  console.log(`Health OK (${durationMs.toFixed(0)} ms). Starting load test against ${API_BASE}.`);
}

function quantile(sorted, q) {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function buildSummary() {
  const rows = [];
  let totalRequests = 0;
  let totalErrors = 0;
  for (const [route, s] of stats) {
    const sorted = [...s.samples].sort((a, b) => a - b);
    const p50 = quantile(sorted, 0.5);
    const p95 = quantile(sorted, 0.95);
    const p99 = quantile(sorted, 0.99);
    const max = sorted[sorted.length - 1] || 0;
    totalRequests += s.samples.length;
    totalErrors += s.errors;
    rows.push({
      route,
      count: s.samples.length,
      errors: s.errors,
      p50_ms: +p50.toFixed(1),
      p95_ms: +p95.toFixed(1),
      p99_ms: +p99.toFixed(1),
      max_ms: +max.toFixed(1),
      statusCounts: s.statusCounts,
    });
  }
  rows.sort((a, b) => b.p95_ms - a.p95_ms);
  return { totalRequests, totalErrors, rows };
}

function printSummary({ totalRequests, totalErrors, rows }) {
  console.log("\n=== Load Test Summary ===");
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Total errors:   ${totalErrors} (${((totalErrors / totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Throughput:     ${(totalRequests / DURATION_SEC).toFixed(1)} req/s`);
  console.log("");
  console.log("Per-route latency (sorted by p95 desc):");
  console.log("");
  console.log(
    [
      "route".padEnd(48),
      "count".padStart(7),
      "err".padStart(5),
      "p50".padStart(8),
      "p95".padStart(8),
      "p99".padStart(8),
      "max".padStart(8),
    ].join(" | ")
  );
  console.log("-".repeat(100));
  for (const r of rows) {
    console.log(
      [
        r.route.padEnd(48).slice(0, 48),
        String(r.count).padStart(7),
        String(r.errors).padStart(5),
        `${r.p50_ms}`.padStart(8),
        `${r.p95_ms}`.padStart(8),
        `${r.p99_ms}`.padStart(8),
        `${r.max_ms}`.padStart(8),
      ].join(" | ")
    );
  }
}

async function main() {
  await probeHealth();
  console.log(`Spinning up ${USERS} virtual users for ${DURATION_SEC}s...`);
  const endTime = performance.now() + DURATION_SEC * 1000;
  const users = Array.from({ length: USERS }, (_, i) => runVirtualUser(i, endTime));
  await Promise.all(users);
  const summary = buildSummary();
  printSummary(summary);
  await fs.writeFile(
    new URL("./load-test-results.json", import.meta.url),
    JSON.stringify({ ...summary, durationSec: DURATION_SEC, users: USERS, apiBase: API_BASE, ranAt: new Date().toISOString() }, null, 2)
  );
  console.log("\nResults written to load-test-results.json");
  process.exit(summary.totalErrors > totalRequestsThreshold(summary) ? 1 : 0);
}

function totalRequestsThreshold(summary) {
  // Fail the test if more than 1% of requests errored.
  return summary.totalRequests * 0.01;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
