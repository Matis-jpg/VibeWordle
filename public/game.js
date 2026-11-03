const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const message = document.getElementById("message");
const newWordButton = document.getElementById("newWordButton");

const keys = [
  "QWERTYUIOP",
  "ASDFGHJKL",
  "ENTERZXCVBNMDEL"
];

let sessionId = "";
let currentGuess = "";
let currentRow = 0;
let gameOver = false;
let loading = false;
let round = 0;
let keyStates = {};

const stats = {
  played: Number(localStorage.getItem("played") || 0),
  wins: Number(localStorage.getItem("wins") || 0),
  streak: Number(localStorage.getItem("streak") || 0)
};

function saveStats() {
  localStorage.setItem("played", stats.played);
  localStorage.setItem("wins", stats.wins);
  localStorage.setItem("streak", stats.streak);
}

function updateStats() {
  document.getElementById("played").textContent = stats.played;
  document.getElementById("wins").textContent = stats.wins;
  document.getElementById("streak").textContent = stats.streak;

  document.getElementById("winRate").textContent =
    stats.played
      ? Math.round((stats.wins / stats.played) * 100) + "%"
      : "0%";
}

function showMessage(text) {
  message.textContent = text;
}

function createBoard() {
  board.innerHTML = "";

  for (let row = 0; row < 6; row++) {
    const rowElement = document.createElement("div");
    rowElement.className = "board-row";

    for (let col = 0; col < 5; col++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${row}-${col}`;

      rowElement.appendChild(tile);
    }

    board.appendChild(rowElement);
  }
}

function createKeyboard() {
  keyboard.innerHTML = "";

  keys.forEach(row => {
    const rowElement = document.createElement("div");
    rowElement.className = "keyboard-row";

    if (row.startsWith("ENTER")) {
      const enter = createKey("ENTER", "wide");
      rowElement.appendChild(enter);

      for (const letter of "ZXCVBNM") {
        rowElement.appendChild(createKey(letter));
      }

      const del = createKey("DEL", "wide");
      rowElement.appendChild(del);
    } else {
      for (const letter of row) {
        rowElement.appendChild(createKey(letter));
      }
    }

    keyboard.appendChild(rowElement);
  });
}

function createKey(letter, extraClass = "") {
  const button = document.createElement("button");

  button.className = `key ${extraClass}`;
  button.textContent =
    letter === "DEL" ? "⌫" : letter;

  button.dataset.key = letter;
  button.addEventListener("click", () => handleKey(letter));

  return button;
}

function updateKeyboard() {
  document.querySelectorAll(".key").forEach(button => {
    const letter = button.dataset.key;
    button.classList.remove("correct", "present", "absent");

    if (keyStates[letter]) {
      button.classList.add(keyStates[letter]);
    }
  });
}

function updateTile(row, col, letter) {
  const tile = document.getElementById(`tile-${row}-${col}`);

  tile.textContent = letter;
  tile.classList.toggle("filled", Boolean(letter));

  if (letter) {
    tile.classList.remove("pop");

    // Restart animation.
    void tile.offsetWidth;

    tile.classList.add("pop");
  }
}

function updateCurrentGuess() {
  for (let i = 0; i < 5; i++) {
    updateTile(currentRow, i, currentGuess[i] || "");
  }
}

function handleKey(key) {
  if (gameOver || loading) return;

  if (key === "ENTER") {
    submitGuess();
    return;
  }

  if (key === "DEL") {
    currentGuess = currentGuess.slice(0, -1);
    updateCurrentGuess();
    return;
  }

  if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
    currentGuess += key;
    updateCurrentGuess();
  }
}

document.addEventListener("keydown", event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (event.key === "Enter") {
    handleKey("ENTER");
  } else if (event.key === "Backspace") {
    handleKey("DEL");
  } else if (/^[a-zA-Z]$/.test(event.key)) {
    handleKey(event.key.toUpperCase());
  }
});

async function apiRequest(endpoint, data) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Something went wrong.");
  }

  return result;
}

async function startNewGame() {
  if (loading) return;

  loading = true;
  newWordButton.disabled = true;
  newWordButton.textContent = "Loading...";

  try {
  board.classList.remove("fade-in");
  board.classList.add("fade-out");

  const result = await apiRequest("/api/new", {
    sessionId
  });

    sessionId = result.sessionId;

    round++;
    currentGuess = "";
    currentRow = 0;
    gameOver = false;
    keyStates = {};

    createBoard();
    createKeyboard();
    updateKeyboard();
    board.classList.remove("fade-out");
board.classList.add("fade-in");

    document.getElementById("roundNumber").textContent =
      `ROUND ${round}`;

    showMessage("Guess the 5-letter word!");

  } catch (error) {
    showMessage(error.message);
  } finally {
    loading = false;
    newWordButton.disabled = false;
    newWordButton.textContent = "↻ New Word";
  }
}

async function submitGuess() {
  if (currentGuess.length !== 5) {
    showMessage("Not enough letters!");
    return;
  }

  loading = true;
  showMessage("Checking...");

  const guess = currentGuess;

  try {
    const result = await apiRequest("/api/guess", {
      sessionId,
      guess
    });

    const { colors, won, lost, answer } = result;

    // Display animated colored feedback.
const rowBeingPlayed = currentRow;

for (let i = 0; i < 5; i++) {
  const tile = document.getElementById(
    `tile-${rowBeingPlayed}-${i}`
  );

  setTimeout(() => {
    tile.classList.add("flip");

    setTimeout(() => {
      tile.classList.add(colors[i]);
    }, 250);

  }, i * 150);

  const letter = guess[i];
  const previous = keyStates[letter];

  const priority = {
    absent: 1,
    present: 2,
    correct: 3
  };

  if (
    !previous ||
    priority[colors[i]] > priority[previous]
  ) {
    keyStates[letter] = colors[i];
  }
}

updateKeyboard();

    currentGuess = "";
    currentRow++;

    if (won) {
      gameOver = true;
      // Celebrate with a staggered bounce.
    for (let i = 0; i < 5; i++) {
    const tile = document.getElementById(
        `tile-${rowBeingPlayed}-${i}`
    );

    setTimeout(() => {
        tile.classList.add("bounce");
    }, 800 + i * 100);
    }
      stats.played++;
      stats.wins++;
      stats.streak++;

      saveStats();
      updateStats();

      showMessage("🎉 Excellent! You guessed the word!");
      return;
    }

    if (lost) {
      gameOver = true;
      stats.played++;
      stats.streak = 0;

      saveStats();
      updateStats();

      showMessage(`Game over! The word was ${answer}.`);
      return;
    }

    showMessage(
      result.attemptsRemaining + " attempts remaining"
    );

  } catch (error) {
  showMessage(error.message);
  board.classList.remove("shake");
  void board.offsetWidth;
  board.classList.add("shake");
  } finally {
    loading = false;
  }
}

// Modal functionality.
document.getElementById("helpButton").addEventListener("click", () => {
  document.getElementById("helpModal").classList.remove("hidden");
});

document.getElementById("statsButton").addEventListener("click", () => {
  updateStats();
  document.getElementById("statsModal").classList.remove("hidden");
});

document.querySelectorAll(".close-button").forEach(button => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.close).classList.add("hidden");
  });
});

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.classList.add("hidden");
    }
  });
});

newWordButton.addEventListener("click", startNewGame);

// Initialize.
updateStats();
startNewGame();