import dotenv from "dotenv";

dotenv.config({
  path: ".env",
});

import fetch from "node-fetch";

const CHANNEL_MAP = {
  error: process.env.SLACK_ERROR_CHANNEL,
};

export const print = (msg) => {
  console.log(msg);
};

export const slackRequest = async (msg, hook) => {
  return await fetch(hook, {
    method: "POST",
    body: JSON.stringify({
      text: `${msg}`,
    }),
  });
};

export const printToSlack = async (msg, channel = "error") => {
  print(msg);

  try {
    const hook = CHANNEL_MAP[channel];

    if (hook) {
      const response = await slackRequest(msg, hook);

      if (response.status !== 200) {
        await slackRequest(`Error sending message to slack: ${channel}`);
      }
    } else {
      await slackRequest(`No slack channel found for ${channel}`);
    }
  } catch (error) {
    print(error);
  }
};
