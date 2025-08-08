// netlify/functions/analyze.js
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return ok("");
  }
  if (event.httpMethod !== "POST") {
    return fail(405, "Method Not Allowed");
  }

  try {
    const { image, mediaType } = JSON.parse(event.body || "{}");
    if (!image || !mediaType) {
      return fail(400, "image and mediaType required");
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return fail(500, "OPENAI_API_KEY not configured");
    }

    const hawaiiNow = new Date().toLocaleString("en-US", { timeZone: "Pacific/Honolulu" });

    const system = `
You are helping Steve (ʻOhana Mortgage Solutions, Kapolei, HI) craft SMS follow-ups for leads he has NOT spoken to yet.

GOALS
- Build trust via short, easy, friendly questions that invite back-and-forth.
- Do NOT push a call or calendar until AFTER at least 2–3 exchanges unless the lead explicitly asks.
- Sound like Steve: warm, plain-spoken, friendly Hawaiʻi-local vibe; no corporate speak; concise; no emojis.

CONSTRAINTS
- First message = one clear, low-friction question (timeline, island/area, rent vs buy, monthly comfort, etc.).
- Keep EACH text <= 160 characters and end with a simple question.
- Avoid rates/jargon unless the lead brought it up.
- Provide a gentle “nudge” if the thread looks stalled.
- Use today's date (Honolulu): ${hawaiiNow} for timing recs.

OUTPUT
Return strict JSON only, no extra prose:
{
  "conversation_summary": "…",
  "lead_temperature": "Hot|Warm|Cold",
  "recommended_action": "Text",
  "primary_recommendation": {
    "type": "Text Message",
    "script": "First message to send (<=160 chars, ends with a question).",
    "timing": "e.g., Within 2 hours"
  },
  "conversation_sequence": [
    "Follow-up Q #1 (<=160 chars).",
    "Follow-up Q #2 (<=160 chars).",
    "Follow-up Q #3 (<=160 chars; may softly offer value, not a call)."
  ],
  "alternative_options": [
    {
      "type": "Nudge (if no reply in 48–72h)",
      "script": "Polite check-in (<=160 chars, ends with a question).",
      "when_to_use": "No response after 2 days"
    }
  ],
  "key_insights": [
    "One-liners about intent/objections/tone cues from the screenshot"
  ],
  "next_steps": "Plain guidance. Only mention booking after 2–3 replies or if they ask."
}
STYLE
- Use Steve’s voice. Examples:
  - "Hey, saw your message—what’s your timeline looking like?"
  - "Are you thinking Oʻahu or another island?"
  - "What payment range would feel comfortable each month?"
- If the lead explicitly asks to call/book, permit a single-line invite with Steve’s link: https://calendly.com/ohana-mortgage/15min
VALIDATE JSON. If image text is unclear, note uncertainty in key_insights but still produce scripts.
`.trim();

    const userPrompt = `
Analyze the attached screenshot of a text conversation between Steve and a lead.
Identify: lead creation recency, last touch, intent signals, objections, tone.
Then produce the strict JSON described above.
`.trim();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        temperature: 0.4,
        max_output_tokens: 1500,
        input: [
          { role: "system", content: [{ type: "input_text", text: system }] },
          {
            role: "user",
            content: [
              { type: "input_text", text: userPrompt },
              {
                type: "input_image",
                image_url: `data:${mediaType};base64,${image}`
              }
            ]
          }
        ]
      })
    });

    if (response.status === 429) {
      return json(529, { error: "Model busy" });
    }

    const raw = await response.text();
    if (!response.ok) {
      return json(500, { error: "OpenAI error", detail: raw });
    }

    const data = JSON.parse(raw);
    const outputText =
      data.output_text ??
      (Array.isArray(data.output) ? data.output.map(x => x.content?.[0]?.text || "").join("\n") : "");

    return json(200, { content: [{ type: "text", text: outputText }] });
  } catch (e) {
    return json(500, { error: e.message });
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
function ok(body) { return { statusCode: 200, headers: cors(), body }; }
function fail(code, msg) { return { statusCode: code, headers: cors(), body: JSON.stringify({ error: msg }) }; }
function json(code, obj) { return { statusCode: code, headers: cors(), body: JSON.stringify(obj) }; }
