const express = require("express");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
      : [];

    if (!messages.length) {
      return res.status(400).json({
        error: "メッセージがありません。"
      });
    }

    const key = process.env.GEMINI_API_KEY;

    if (!key) {
      return res.status(500).json({
        error: "GEMINI_API_KEYが設定されていません。"
      });
    }

    const prompt = messages
      .map(m => {
        const role = m.role === "assistant" ? "ZENAI" : "ユーザー";
        return `${role}: ${m.content}`;
      })
      .join("\n");

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "あなたはZENAIという日本語AIアシスタントです。親しみやすく、分かりやすく回答してください。\n\n" +
                    prompt
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini APIエラー"
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "回答を取得できませんでした。";

    res.json({
      text
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: e.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ZENAI listening on port ${PORT}`);
});
