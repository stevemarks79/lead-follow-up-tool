exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { image, mediaType } = JSON.parse(event.body);

    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,  // Add the API key header
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: image
                }
              },
              {
                type: "text",
                text: `As a mortgage broker in Hawaii specializing in "hero homeowners" (veterans, first responders, education, healthcare workers), analyze this text conversation screenshot and provide specific follow-up recommendations.

TODAY'S DATE: July 24, 2025

CRITICAL ANALYSIS POINTS:
- Look at LEAD CREATION DATE in Contact Notes (right side)
- Look at MESSAGE TIMESTAMPS to understand response timing
- Calculate days since last interaction using today's date (July 24, 2025)
- Distinguish between "went cold" vs "stated future timeline" 
- Don't confuse system updates with customer actions
- If it's been several days since their last text, acknowledge the delay appropriately

IMPORTANT STYLE GUIDELINES:
- Keep texts SHORT (1-2 sentences max, paragraph breaks if longer)
- Use "Hi" for first contact, "Hey" for return contacts
- Mirror their greeting style if they used one
- Be conversational but professional - like Steve from Ohana Mortgage
- Include calendar link when suggesting calls: https://link.ohanamortgage.com/widget/bookings/ohana-initial-call
- Be direct and helpful, not pushy
- Use contractions naturally
- No big blocks of text
- If responding days later, acknowledge timing naturally ("Sorry for the delay" or similar)

Please respond with a JSON object containing:
{
  "conversation_summary": "Brief summary including key dates and timeline context",
  "lead_temperature": "Hot/Warm/Cold", 
  "days_since_last_contact": "Number of days since their last message",
  "timing_context": "How the delay affects approach",
  "recommended_action": "Text/Call/Email/Wait",
  "primary_recommendation": {
    "type": "Text Message/Phone Call/Email",
    "script": "Exact text to send or what to say (keep SHORT, acknowledge timing if needed)",
    "timing": "When to send this"
  },
  "alternative_options": [
    {
      "type": "option type", 
      "script": "alternative script (keep SHORT)",
      "when_to_use": "specific scenario"
    }
  ],
  "key_insights": ["insight1", "insight2"],
  "next_steps": "What to do after this contact"
}

Focus on converting to a phone call or pre-approval application. Write texts exactly like Steve would - conversational, helpful, and brief. Pay close attention to dates and timing context.`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
