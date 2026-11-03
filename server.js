const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

// Possible secret words.
const WORDS = require("./words.json");

if (!Array.isArray(WORDS) || WORDS.length === 0) {
  throw new Error("Dictionary is empty. Run npm run setup first.");
}

const VALID_WORDS = new Set(WORDS);
const sessions = new Map();

function chooseWord(previousWord) {
  const available = WORDS.filter(word => word !== previousWord);
  const pool = available.length ? available : WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function scoreGuess(guess, answer) {
  const result = Array(5).fill("absent");
  const remaining = answer.split("");

  // First pass: identify correct positions.
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      remaining[i] = null;
    }
  }

  // Second pass: identify misplaced letters.
  for (let i = 0; i < 5; i++) {
    if (result[i] === "correct") continue;

    const index = remaining.indexOf(guess[i]);

    if (index !== -1) {
      result[i] = "present";
      remaining[index] = null;
    }
  }

  return result;
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 10000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === "POST" && url.pathname === "/api/new") {
      const body = await readBody(req);

      let sessionId = body.sessionId;

      if (
        typeof sessionId !== "string" ||
        !/^[a-f0-9]{32}$/.test(sessionId)
      ) {
        sessionId = crypto.randomBytes(16).toString("hex");
      }

      const previous = sessions.get(sessionId)?.previousWord || null;
      const answer = chooseWord(previous);

      sessions.set(sessionId, {
        answer,
        previousWord: answer,
        guesses: 0,
        finished: false
      });

      return sendJSON(res, 200, {
        sessionId,
        attempts: 6,
        wordLength: 5
      });
    }

    if (req.method === "POST" && url.pathname === "/api/guess") {
      const body = await readBody(req);
      const { sessionId } = body;
      const guess = String(body.guess || "").toUpperCase();

      const session = sessions.get(sessionId);

      if (!session) {
        return sendJSON(res, 400, {
          error: "Game session not found. Start a new game."
        });
      }

      if (session.finished) {
        return sendJSON(res, 400, {
          error: "This round is already finished."
        });
      }

      if (!/^[A-Z]{5}$/.test(guess)) {
        return sendJSON(res, 400, {
          error: "Your guess must contain exactly five letters."
        });
      }

      if (!VALID_WORDS.has(guess)) {
        return sendJSON(res, 400, {
          error: "Not in the word list."
        });
      }

      const colors = scoreGuess(guess, session.answer);
      session.guesses++;

      const won = guess === session.answer;
      const lost = !won && session.guesses >= 6;

      if (won || lost) {
        session.finished = true;
      }

      return sendJSON(res, 200, {
        guess,
        colors,
        won,
        lost,
        attemptsRemaining: 6 - session.guesses,
        answer: won || lost ? session.answer : null
      });
    }

    // Serve frontend files.
    const requestedPath = url.pathname === "/"
      ? "index.html"
      : url.pathname.slice(1);

    const filePath = path.resolve(
      __dirname,
      "public",
      requestedPath
    );

    const publicDir = path.resolve(__dirname, "public");

    if (
      !filePath.startsWith(publicDir + path.sep) &&
      filePath !== path.join(publicDir, "index.html")
    ) {
      return sendJSON(res, 403, { error: "Forbidden" });
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return sendJSON(res, 404, { error: "Not found" });
    }

    const extensions = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript"
    };

    res.writeHead(200, {
      "Content-Type":
        extensions[path.extname(filePath)] || "application/octet-stream"
    });

    fs.createReadStream(filePath).pipe(res);

  } catch (error) {
    console.error(error);
    sendJSON(res, 500, { error: "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`Word game running at http://localhost:${PORT}`);
});