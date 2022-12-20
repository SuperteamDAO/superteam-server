# Superteam Server

This is used for the `instagrant-program` and `superteam-earn` program as of now
and is hosted onf [fly.io](https://fly.io)

## Env
The following env are required for the application to work

```
PORT=3000

AUTH_TOKEN=secret-key-which-ensures-only-authorized-clients-can-use-endpoint

TWITTER_ACCESS_TOKEN_KEY=access-token-of-twitter-app
TWITTER_ACCESS_TOKEN_SECRET=secret-token-of-twitter-app
TWITTER_CONSUMER_KEY=key-of-the-user-used-for-dm
TWITTER_CONSUMER_SECRET=secret-of-the-user-used-for-dm
INSTAGRANT_FROM=form-to-send-on-dm

AIRTABLE_API_KEY=api-key-of-the-airtable-account
AIRTABLE_BASE_ID=base-table-id

ALGOLIA_APPLICATION_ID=
ALGOLIA_ADMIN_KEY=
ALGOLIA_INDEX_NAME=
```

## Twitter
- The `/` endpoint is invoked by Zapier whenever the airtable for `Twitter Grants` is updated
  by an approver for an approved Instagrants tweet.
- This endpoint sends a DM to the user after their instagrant has been approved

## AirTable
- The `/earn` endpoint is invoked by Zapier whenever the airtable for `Superteam Earn Opportunities`
  is updated for a new earn opportunity.

