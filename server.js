const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

const server = http.createServer(async (req, res) => {

  // Health check
  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, {
      "Content-Type": "application/json"
    });

    return res.end(JSON.stringify({
      ok: true,
      model: MODEL
    }));
  }

  // Chat API
  if (req.method === "POST" && req.url === "/api/chat") {

    if (!API_KEY) {
      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      return res.end(JSON.stringify({
        error: "GEMINI_API_KEY が設定されていません"
      }));
    }

    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", async () => {

      try {
        const data = JSON.parse(body);

        const message = data.message;
        const previousInteractionId = data.interactionId || null;

        if (!message) {
          res.writeHead(400, {
            "Content-Type": "application/json"
          });

          return res.end(JSON.stringify({
            error: "message がありません"
          }));
        }

        const requestBody = {
          model: MODEL,
          input: message,
          stream: true,

          generation_config: {
            thinking_summaries: "auto"
          }
        };

        // 会話を継続
        if (previousInteractionId) {
          requestBody.previous_interaction_id =
            previousInteractionId;
        }

        const response = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/interactions",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": API_KEY
            },

            body: JSON.stringify(requestBody)
          }
        );

        if (!response.ok) {
          const errorText = await response.text();

          res.writeHead(response.status, {
            "Content-Type": "application/json"
          });

          return res.end(JSON.stringify({
            error: errorText
          }));
        }

        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no"
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        let buffer = "";

        while (true) {

          const { value, done } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, {
            stream: true
          });

          const lines = buffer.split("\n");

          buffer = lines.pop() || "";

          for (const line of lines) {

            if (!line.startsWith("data:")) {
              continue;
            }

            const raw = line.slice(5).trim();

            if (!raw || raw === "[DONE]") {
              continue;
            }

            try {

              const event = JSON.parse(raw);

              // Interaction ID
              if (
                event.event_type === "interaction.created" &&
                event.interaction
              ) {

                res.write(
                  `data: ${JSON.stringify({
                    type: "interaction",
                    id: event.interaction.id
                  })}\n\n`
                );
              }

              // Step delta
              if (
                event.event_type === "step.delta" &&
                event.delta
              ) {

                const delta = event.delta;

                // 思考サマリー
                if (
                  delta.type === "thought_summary"
                ) {

                  const text =
                    delta.content?.text || "";

                  if (text) {

                    res.write(
                      `data: ${JSON.stringify({
                        type: "thought",
                        text
                      })}\n\n`
                    );
                  }
                }

                // 通常回答
                else if (
                  delta.type === "text"
                ) {

                  if (delta.text) {

                    res.write(
                      `data: ${JSON.stringify({
                        type: "text",
                        text: delta.text
                      })}\n\n`
                    );
                  }
                }
              }

              // 完了
              if (
                event.event_type === "interaction.completed" &&
                event.interaction
              ) {

                res.write(
                  `data: ${JSON.stringify({
                    type: "done",
                    interactionId:
                      event.interaction.id
                  })}\n\n`
                );
              }

            } catch (err) {
              console.error(
                "SSE parse error:",
                err
              );
            }
          }
        }

        res.write(
          `data: ${JSON.stringify({
            type: "done"
          })}\n\n`
        );

        res.end();

      } catch (error) {

        console.error(error);

        if (!res.headersSent) {
          res.writeHead(500, {
            "Content-Type": "application/json"
          });

          return res.end(JSON.stringify({
            error: error.message
          }));
        }

        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: error.message
          })}\n\n`
        );

        res.end();
      }
    });

    return;
  }

  // 静的ファイル
  let filePath = req.url === "/"
    ? path.join(__dirname, "index.html")
    : path.join(__dirname, req.url);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    return res.end("Not Found");
  }

  const ext = path.extname(filePath);

  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json"
  };

  res.writeHead(200, {
    "Content-Type":
      types[ext] || "application/octet-stream"
  });

  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(
    `ZENAI server running on port ${PORT}`
  );

  console.log(
    `Model: ${MODEL}`
  );
});
