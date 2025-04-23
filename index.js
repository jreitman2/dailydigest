require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');
const { WebClient } = require('@slack/web-api');
const fs = require('fs');

// Debug environment variables
console.log('Environment variables check:');
console.log('PRODUCT_HUNT_API_KEY:', process.env.PRODUCT_HUNT_API_KEY ? '✓ Present' : '✗ Missing');
console.log('PRODUCT_HUNT_CLIENT_SECRET:', process.env.PRODUCT_HUNT_CLIENT_SECRET ? '✓ Present' : '✗ Missing');

// Safely log OpenAI key (only first 4 and last 4 characters)
const openaiKey = process.env.OPENAI_API_KEY;
if (openaiKey) {
  const maskedKey = `${openaiKey.substring(0, 4)}...${openaiKey.substring(openaiKey.length - 4)}`;
  console.log('OPENAI_API_KEY:', `✓ Present (${maskedKey})`);
} else {
  console.log('OPENAI_API_KEY:', '✗ Missing');
  console.log('Current environment variables:', Object.keys(process.env));
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Slack
const slackToken = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL_ID;

console.log('Slack Configuration:');
console.log('Bot Token:', slackToken ? `${slackToken.substring(0, 15)}...` : 'Missing');
console.log('Channel ID:', SLACK_CHANNEL);

if (!slackToken) {
  throw new Error('SLACK_BOT_TOKEN is required');
}

if (!SLACK_CHANNEL) {
  throw new Error('SLACK_CHANNEL_ID is required');
}

const slack = new WebClient(slackToken);

// Debug: Check environment variables (masked for security)
const apiKey = process.env.PRODUCT_HUNT_API_KEY;
const clientSecret = process.env.PRODUCT_HUNT_CLIENT_SECRET;

console.log('Environment check:');
console.log('API Key present:', apiKey ? `Yes (starts with ${apiKey.substring(0, 4)}...)` : 'No');
console.log('Client Secret present:', clientSecret ? `Yes (starts with ${clientSecret.substring(0, 4)}...)` : 'No');

const PRODUCT_HUNT_API_URL = 'https://api.producthunt.com/v2/api/graphql';

// Get yesterday's date in ISO format
function getYesterdayISODate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString();
}

async function getAccessToken() {
  try {
    console.log('Attempting to get access token...');
    console.log('Request payload:', {
      client_id: `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`,
      client_secret: `${clientSecret.substring(0, 4)}...${clientSecret.substring(clientSecret.length - 4)}`,
      grant_type: 'client_credentials'
    });

    const tokenResponse = await axios.post('https://api.producthunt.com/v2/oauth/token', {
      client_id: process.env.PRODUCT_HUNT_API_KEY,
      client_secret: process.env.PRODUCT_HUNT_CLIENT_SECRET,
      grant_type: 'client_credentials'
    });

    console.log('Successfully obtained access token');
    return tokenResponse.data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error.message);
    if (error.response) {
      console.error('Token error response:', error.response.data);
    }
    throw error;
  }
}

async function generateDigest(posts) {
  const prompt = `You are LaunchScreenerGPT, a sharp, forward-thinking analyst for Headless Agents.

════════════════ CONTEXT ════════════════
You are analyzing Product Hunt launches to identify potential competitors or relevant tools for Headless Agents—a B2B platform that helps software teams build, test, deploy, and monitor AI agents & AI-powered features.

Key areas of interest:
• AI/LLM agent frameworks or orchestration
• Prompt / test / evaluation pipelines for AI features
• Dev-tooling or infra that speeds AI feature deployment & governance
• Agent-to-Agent (A2A) protocols or interoperability layers
• Monitoring, analytics, observability, or experimentation for AI models
• Role-based collaboration around AI feature development

════════════════ TASK ════════════════
1. Filter for relevant launches (high or medium relevance only)
2. Score relevance as "high" (clear competitor/strong adjacency) or "medium" (partial overlap/future threat)
3. Provide product overview and actionable reasoning for each match

════════════════ INPUT DATA ════════════════
${JSON.stringify(posts, null, 2)}

════════════════ REQUIRED FORMAT ════════════════
Return only a JSON array named "headlessRelevant" with objects following this structure:
{
  "name": "product name",
  "url": "product hunt link",
  "relevance": "high" or "medium",
  "overview": "2-3 sentence factual product description",
  "reasoning": "2-3 sentence competitive analysis"
}

════════════════ GUIDELINES ════════════════
• Be decisive - fewer high-quality picks are better
• If unsure, drop it
• Consider future competitive threats
• Base reasoning only on provided product descriptions
• No narrative text, only JSON output`;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4.1",
    temperature: 0.7,
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(completion.choices[0].message.content);
  
  // Format the results into a readable markdown digest
  let digest = "# Headless Agents - Competitive Intelligence Digest\n\n";
  
  // Sort by relevance (high first)
  result.headlessRelevant.sort((a, b) => 
    a.relevance === b.relevance ? 0 : a.relevance === "high" ? -1 : 1
  );

  // Group by relevance
  const highRelevance = result.headlessRelevant.filter(item => item.relevance === "high");
  const mediumRelevance = result.headlessRelevant.filter(item => item.relevance === "medium");

  if (highRelevance.length > 0) {
    digest += "## 🔥 High Relevance\n\n";
    highRelevance.forEach(item => {
      digest += `### [${item.name}](${item.url})\n`;
      digest += `**Product Overview:** ${item.overview}\n\n`;
      digest += `**Analysis:** ${item.reasoning}\n\n`;
    });
  }

  if (mediumRelevance.length > 0) {
    digest += "## 👀 Medium Relevance\n\n";
    mediumRelevance.forEach(item => {
      digest += `### [${item.name}](${item.url})\n`;
      digest += `**Product Overview:** ${item.overview}\n\n`;
      digest += `**Analysis:** ${item.reasoning}\n\n`;
    });
  }

  if (result.headlessRelevant.length === 0) {
    digest += "_No relevant launches found in the last 24 hours._\n";
  }

  return digest;
}

// Test Slack connection
async function testSlackConnection() {
  try {
    console.log('Testing Slack connection...');
    const result = await slack.auth.test();
    console.log('Slack connection successful!');
    console.log('Connected as:', result.user);
    console.log('To team:', result.team);
    return true;
  } catch (error) {
    console.error('Slack connection test failed:', error);
    return false;
  }
}

async function sendToSlack(digest) {
  try {
    console.log('Attempting to send message to Slack...');
    console.log('Using channel:', SLACK_CHANNEL);
    
    const result = await slack.chat.postMessage({
      channel: SLACK_CHANNEL,
      text: digest,
      mrkdwn: true
    });

    console.log('Message sent successfully:', result.ts);
    return result;
  } catch (error) {
    console.error('Detailed Slack error:', error);
    throw error;
  }
}

async function exploreProductHuntAPI() {
  try {
    // Test Slack connection first
    const slackConnected = await testSlackConnection();
    if (!slackConnected) {
      console.error('Slack connection failed, please check your token and permissions');
      return;
    }

    const accessToken = await getAccessToken();
    const yesterday = getYesterdayISODate();
    
    const query = `
      query {
        posts(first: 20) {
          edges {
            node {
              name
              tagline
              description
              url
              topics {
                edges {
                  node {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const response = await axios({
      url: 'https://api.producthunt.com/v2/api/graphql',
      method: 'post',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      data: {
        query: query
      }
    });

    // Debug: Log the API response structure
    console.log('API Response:', JSON.stringify(response.data, null, 2));

    if (!response.data || !response.data.data) {
      console.error('Unexpected API response structure:', response.data);
      return;
    }

    if (!response.data.data.posts || !response.data.data.posts.edges) {
      console.error('No posts data found in response');
      return;
    }

    if (response.data.data.posts.edges.length === 0) {
      console.log('No posts found in the last 24 hours');
      return;
    }

    const posts = response.data.data.posts.edges.map(edge => {
      const post = edge.node;
      return {
        name: post.name,
        tagline: post.tagline,
        description: post.description,
        url: post.url,
        topics: post.topics.edges.map(t => t.node.name),
        category: post.topics.edges[0]?.node.name || 'Uncategorized'
      };
    });

    console.log(`Found ${posts.length} posts from the last 24 hours`);

    // Save raw data
    fs.writeFileSync('raw_posts.json', JSON.stringify(posts, null, 2));
    console.log('\nRaw data saved to raw_posts.json');

    // Generate digest using OpenAI
    const digest = await generateDigest(posts);
    
    // Save formatted digest
    fs.writeFileSync('competitive_digest.md', digest);
    console.log('\nFormatted digest saved to competitive_digest.md');
    
    // Send to Slack
    await sendToSlack(digest);
    console.log('\nDigest sent to Slack successfully');
    
    // Also display in console
    console.log('\nCompetitive Intelligence Digest:\n');
    console.log(digest);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the script
exploreProductHuntAPI(); 