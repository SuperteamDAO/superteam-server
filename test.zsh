#!/bin/env zsh

set -x

# First export the env
export $(cat .env | xargs)

# First try out the earn index end point
http POST ${FLY_URL}/earn AUTH_TOKEN:${AUTH_TOKEN}

# Test out the getro job listings endpoint
http POST ${FLY_URL}/getro AUTH_TOKEN:${AUTH_TOKEN}

# Test out sending a DM to srijanshetty
http POST ${FLY_URL}/instagrant AUTH_TOKEN:${AUTH_TOKEN} applier=srijanshetty tweet="https://google.com"
