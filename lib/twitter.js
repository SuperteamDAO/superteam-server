import dotenv from "dotenv";
dotenv.config({
  path: ".env",
});
import Twitter from "twitter-lite";

const client = new Twitter({
  consumer_key: process.env["TWITTER_CONSUMER_KEY"],
  consumer_secret: process.env["TWITTER_CONSUMER_SECRET"],
  access_token_key: process.env["TWITTER_ACCESS_TOKEN_KEY"],
  access_token_secret: process.env["TWITTER_ACCESS_TOKEN_SECRET"],
});

const INSTAGRANT_FORM = process.env.INSTAGRANT_FORM;

// Function to actually send the DM
export async function sendDM(data) {
  try {
    // deconstruct the data from the form
    const { tweet, applier } = data;

    // Figure out the userId of the user
    const lookup = await client.post("users/lookup", {
      screen_name: applier,
    });

    const userId = lookup?.[0].id_str;
    const userName = lookup?.[0].name;

    if (!userId) {
      console.log("No user found for request");
      return [false, "Could not find user"];
    }

    // Send the actual DM
    await client.post("direct_messages/events/new", {
      event: {
        type: "message_create",
        message_create: {
          target: {
            recipient_id: userId,
          },
          message_data: {
            text: `Congratulations ${userName}, your Instagrant has been approved! Please fill in this form to claim the grant and start onboarding -- ${INSTAGRANT_FORM}. For any further communication you can write to hello@superteam.fun. ${tweet}`,
          },
        },
      },
    });

    console.log(`DM sent to ${applier}`);
    return [true, "DM sent"];
  } catch (e) {
    console.log(e);
  }
}
