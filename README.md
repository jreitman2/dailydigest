# Product Hunt Competitive Intelligence Bot

Automatically generates daily competitive intelligence digests from Product Hunt launches, analyzing them for relevance to Headless Agents and posting summaries to Slack.

## Features

- Daily monitoring of Product Hunt launches
- AI-powered analysis using GPT-4
- Automatic categorization by relevance
- Slack integration for daily digests
- Runs automatically via GitHub Actions

## Setup

1. Fork this repository
2. Add the following secrets to your GitHub repository:
   - `PRODUCT_HUNT_API_KEY`: Your Product Hunt API key
   - `PRODUCT_HUNT_CLIENT_SECRET`: Your Product Hunt client secret
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `SLACK_BOT_TOKEN`: Your Slack bot token
   - `SLACK_CHANNEL_ID`: Your Slack channel ID

## Local Development

```bash
# Install dependencies
npm install

# Create .env file with required environment variables
cp .env.example .env

# Run locally
node index.js
```

## Environment Variables

Create a `.env` file with:

```
PRODUCT_HUNT_API_KEY=your_key
PRODUCT_HUNT_CLIENT_SECRET=your_secret
OPENAI_API_KEY=your_key
SLACK_BOT_TOKEN=your_token
SLACK_CHANNEL_ID=your_channel
```

## Schedule

The digest runs daily at 8:00 AM EST via GitHub Actions. You can also trigger it manually from the Actions tab. 