const { habitTools } = require("../mcp/tools");
const openai = require("../config/openai");

async function query(req, res) {
    const user_id = req.id;
    const { message, habit_id, challenge_id } = req.body;
    const today = new Date().toISOString().split("T")[0];

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }
    let scope = null;

    if (!habit_id && !challenge_id) {
        return res.status(400).json({ error: "habit_id or challenge_id is missing" });
    }

    if (habit_id) scope = "habit";
    if (challenge_id) scope = "challenge";


    const systemPrompt = `
You are a Habit/Challenge Progress Analyst.

TODAY'S DATE:
- Today is ${today}. This is the only valid current date.

CONTEXT GUARANTEE:
- The current request is scoped to a ${scope}.
- You MUST analyze only ${scope} data.
- You MUST NOT reference or assume the existence of the other entity type.

TIME INTERPRETATION RULES:
- If the user mentions relative time (e.g., "last week", "last month", "last 7 days"),
  interpret it strictly relative to today's date.
- Never assume or invent a different current date.
- If a date range cannot be derived unambiguously, state that clearly instead of guessing.

DATA SCOPE:
- You only have access to habit completion records (date + status).
- You do NOT have access to user intentions, motivations, emotions, or external context.

CORE RESPONSIBILITY:
- YOU must perform the analysis yourself.
- NEVER ask the user to figure out patterns for you.
- All insights must be derived directly from the data provided.
- No other questions except for habit and challenge stats should be entertained. Refuse instantly if asked.

ANALYSIS RULES:
- Do NOT speculate about psychological or personal causes.
- Do NOT give motivational advice.
- Only state facts that can be calculated from the data.

WHEN ASKED ABOUT IMPROVEMENT OR FAILURES:
1. First, calculate and state concrete insights, such as:
   - Most-missed weekday(s)
   - Completion rate on weekdays vs weekends
   - Longest gap between completions
   - Periods with clustered misses
   - Trend comparison (early vs late in the period, if applicable)

2. Then, ask reflective questions that are:
   - Directly based on those calculated insights
   - Specific and measurable
   - Framed as self-observation, not advice

   Example formats:
   - "Misses occurred most frequently on Tuesdays and Thursdays. What was different about those days?"
   - "Your completion rate dropped from 75% in the first half of the month to 45% in the second half. What changed during that period?"

FAILURE REASONS HANDLING:
- If asked for reasons, respond only with data-supported possibilities
  (e.g., "failures are concentrated on weekends").
- Explicitly state when true causes cannot be determined from the data.


OUTPUT REQUIREMENTS:
- Always reference exact numbers and date ranges.
- Always mention today's date.
- If no data exists for the requested period, say so clearly.
- Tone must remain factual, neutral, and analytical.
`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
        ],
        tools: [
            {
                type: "function",
                function: {
                    name: "get_habit_stats",
                    descrption: "Function get the statistics of the habit for the user required interval of time",
                    parameters: {
                        type: "object",
                        properties: {
                            from: { type: "string" },
                            to: { type: "string" }
                        },
                        required: ["from", "to"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "get_challenge_stats",
                    descrption: "Function get the statistics of the challenge for the user required interval of time",
                    parameters: {
                        type: "object",
                        properties: {
                            from: { type: "string" },
                            to: { type: "string" }
                        },
                        required: ["from", "to"]
                    }
                }
            }
        ],
        tool_choice: "auto"
    });

    const msg = completion.choices[0].message;

    if (msg.tool_calls?.length) {
        if (msg.tool_calls?.length > 1) {
            throw new Error("Multiple tool calls are not allowed");
        }

        const call = msg.tool_calls[0];
        const tool = habitTools[call.function.name];
        const parsedArgs = JSON.parse(call.function.arguments);

        const context = {
            user_id,
            habit_id,
            challenge_id
        };

        result = await tool.handler(parsedArgs, context);


        const followUp = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message },
                msg,
                {
                    role: "tool",
                    tool_call_id: call.id,
                    content: JSON.stringify(result)
                }
            ]
        });

        return res.json({ answer: followUp.choices[0].message.content });
    }

    return res.json({ answer: msg.content });
}

module.exports = { query };
