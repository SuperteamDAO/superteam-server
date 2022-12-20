// Configure dotenv to read env
import dotenv from "dotenv";
dotenv.config({
  path: ".env",
});

import express from "express";
import rateLimit from "express-rate-limit";
import bodyParser from "body-parser";
import morgan from "morgan";
import morganBody from "morgan-body";

import { sendDM } from "./lib/twitter.js";
import { updateIndex, updateGetroJobs, updateClouflareIndex } from "./lib/jobs.js";
import PScale from './service/pscale.js';

const PORT = process.env["PORT"];
const AUTH_TOKEN = process.env["AUTH_TOKEN"];

const app = express();

// Apply the rate limiting middleware to all requests
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Limit each IP to 100 requests per `window`
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  })
);

/*
 * For bots to check keepalive
 */
app.get("/keepalive", async (_req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.end("Success");
});

// Parse the body into well fromatted JSON
// to be consumed by middlewares
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  morgan('combined', {
    skip: (req, _res) => {
      if (req.baseUrl === '/keepalive') {
        return false;
      }

      return true;
    },
  })
);
morganBody(app, {
  logResponseBody: true,
});

/*
 * Endpoint '/instagrant' for the bot to send DMs
 */
app.post("/instagrant", async (req, res) => {
  if (req.get("AUTH_TOKEN") === AUTH_TOKEN) {
    console.log(req.body);

    // Trigger a DM to the applier
    const [status, msg] = await sendDM(req.body);

    if (status) {
      res.setHeader("Content-Type", "text/plain");
      res.end(msg);
    } else {
      res.status(400).end(msg);
    }
  } else {
    res.status(401).end("Access Denied");
  }
});

/*
 * This endpoint is used to handle earn opportunities
 */
app.post("/earn", async (req, res) => {
  if (req.get("AUTH_TOKEN") === AUTH_TOKEN) {
    // Trigger a DM to the applier
    const [status, msg] = await updateIndex();

    if (status) {
      res.setHeader("Content-Type", "text/plain");
      res.end(msg);
    } else {
      res.status(400).end(msg);
    }
  } else {
    res.status(401).end("Access Denied");
  }
});

/*
 * This endpoint is used to update getro jobs
 */
app.post("/getro", async (req, res) => {
  if (req.get("AUTH_TOKEN") === AUTH_TOKEN) {
    // Trigger a DM to the applier
    const [status, msg] = await updateGetroJobs();

    if (status) {
      res.setHeader("Content-Type", "text/plain");
      res.end(msg);
    } else {
      res.status(400).end(msg);
    }
  } else {
    res.status(401).end("Access Denied");
  }
});

/*
 * This endpoint is used index opportunities
 */
app.post("/index/cloudflare", async (_req, res) => {
  await updateClouflareIndex();

  res.setHeader("Content-Type", "text/plain");
  res.end("Updated");
});

// Start listening
app.listen(PORT, async () => {
  await PScale.init();
  console.log(`App listening on port ${PORT}`);
});
