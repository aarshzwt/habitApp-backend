const { openai } = require("../src/config/openai");

async function test() {
  const res = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: "You are a test assistant" },
      { role: "user", content: "Say hello" }
    ],
  });
  console.log(res)

  console.log(res.choices[0].message.content);
}

test();
