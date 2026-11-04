const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;
const WORDS = require("./words.json");

if (!Array.isArray(WORDS) || WORDS.length === 0) {
  throw new Error("Dictionary is empty. Run npm run setup first.");
}

const VALID_WORDS = new Set(WORDS);
const WORD_LENGTHS = [5, 6, 7];
const sessions = new Map();

function chooseWord(wordLength, previousWord) {
  const pool = WORDS.filter(word =>
    word.length === wordLength && word !== previousWord
  );
  const fallback = WORDS.filter(word => word.length === wordLength);

  if (fallback.length === 0) {
    throw new Error(`No ${wordLength}-letter words are available. Run npm run setup.`);
  }

  const available = pool.length ? pool : fallback;
  return available[Math.floor(Math.random() * available.length)];
}

function scoreGuess(guess, answer) {
  const result = Array(answer.length).fill("absent");
  const remaining = answer.split("");

  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      remaining[i] = null;
    }
  }

  for (let i = 0; i < answer.length; i++) {
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
      const wordLength = Number(body.wordLength || 5);

      if (!WORD_LENGTHS.includes(wordLength)) {
        return sendJSON(res, 400, { error: "Choose a 5, 6, or 7-letter mode." });
      }

      let sessionId = body.sessionId;
      if (typeof sessionId !== "string" || !/^[a-f0-9]{32}$/.test(sessionId)) {
        sessionId = crypto.randomBytes(16).toString("hex");
      }

      const previousWords = sessions.get(sessionId)?.previousWords || {};
      const answer = chooseWord(wordLength, previousWords[wordLength] || null);
      previousWords[wordLength] = answer;

      sessions.set(sessionId, {
        answer,
        wordLength,
        previousWords,
        guesses: 0,
        finished: false
      });

      return sendJSON(res, 200, {
        sessionId,
        attempts: 6,
        wordLength
      });
    }

    if (req.method === "POST" && url.pathname === "/api/guess") {
      const body = await readBody(req);
      const session = sessions.get(body.sessionId);
      const guess = String(body.guess || "").toUpperCase();

      if (!session) {
        return sendJSON(res, 400, { error: "Game session not found. Start a new game." });
      }
      if (session.finished) {
        return sendJSON(res, 400, { error: "This round is already finished." });
      }
      if (!new RegExp(`^[A-Z]{${session.wordLength}}$`).test(guess)) {
        return sendJSON(res, 400, {
          error: `Your guess must contain exactly ${session.wordLength} letters.`
        });
      }
      if (!VALID_WORDS.has(guess)) {
        return sendJSON(res, 400, { error: "Not in the word list." });
      }

      const colors = scoreGuess(guess, session.answer);
      session.guesses++;

      const won = guess === session.answer;
      const lost = !won && session.guesses >= 6;
      if (won || lost) session.finished = true;

      return sendJSON(res, 200, {
        guess,
        colors,
        won,
        lost,
        attemptsRemaining: 6 - session.guesses,
        answer: won || lost ? session.answer : null
      });
    }

    const requestedPath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const filePath = path.resolve(__dirname, "public", requestedPath);
    const publicDir = path.resolve(__dirname, "public");

    if (!filePath.startsWith(publicDir + path.sep) &&
        filePath !== path.join(publicDir, "index.html")) {
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
      "Content-Type": extensions[path.extname(filePath)] || "application/octet-stream"
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error(error);
    sendJSON(res, 500, { error: error.message || "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`Word game running at http://localhost:${PORT}`);
});
