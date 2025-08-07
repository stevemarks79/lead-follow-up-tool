// netlify/functions/refine.js
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors(), body: "Method Not Allowed" };
  }

  try {
    const { originalAnalysis, feedback } = JSON.parse(event.body || "{}");
    if (!originalAnalysis || !feedback) {
      return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "originalAnalysis and feedback required" }) };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: "OPENAI_API_KEY not configured" }) };
    }

    const system = `
You are refining an existing JSON follow-up plan for Steve (ʻOhana Mortgage Solutions).

GOALS
- Maintain the EXACT same JSON structure (including conversation_sequence).
- Apply Steve’s feedback while keeping the trust-building flow:
  short Qs → back-and-forth → (maybe) invite later.
- Each message <= 160 chars; Steve’s voice; no corporate speak; no emojis.

RULES
- Do NOT add a call/calendar invite unless the feedback explicitly asks for it OR the original shows the lead requested one.
- If feedback says “more casual,” simplify wording, not meaning.
- If feedback says “more direct,” keep questions but remove fluff.
- If feedback requests a topic pivot (timeline, area, budget, VA/FHA, etc.), pivot the questions accordingly.
- If feedback conflicts with earlier constraints, the feedback wins.

OUTPUT
Return only VALID JSON following the original schema. No extra prose.
`.trim();

    const userPrompt = `
Original JSON:
${JSON.stringify(originalAnalysis, null, 2)}

Feedback from Steve:
"""${feedback}"""

Refine the JSON per the system rules. Return ONLY the JSON.
`.trim();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        temperature: 0.3,
        max_output_tokens: 1200,
        input: [
          { role: "system", content: [{ type: "text", text: system }] },
          { role: "user", content: [{ type: "input_text", text: userPrompt }] }
        ]
      })
    });

    if (response.status === 429) {
      return { statusCode: 529, headers: cors(), body: JSON.stringify({ error: "Model busy" }) };
    }

    if (!response.ok) {
      const errText = await response.text();
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: "OpenAI error", detail: errText }) };
    }

    const data = await response.json();
    const outputText = data.output_text || (Array.isArray(data.output) ? data.output.map(x => x.content?.[0]?.text || "").join("\n") : "");
    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({ content: [{ type: "text", text: outputText }] })
    };
  } catch (e) {
    return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: e.message }) };
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
}
