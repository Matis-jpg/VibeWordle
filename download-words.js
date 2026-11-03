const fs = require("fs");

const URL =
  "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt";

async function downloadWords() {
  console.log("Downloading English dictionary...");

  const response = await fetch(URL);

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }

  const text = await response.text();

  const words = [
    ...new Set(
      text
        .split(/\r?\n/)
        .map(word => word.trim().toUpperCase())
        .filter(word => /^[A-Z]{5}$/.test(word))
    )
  ].sort();

  if (words.length === 0) {
    throw new Error("No five-letter words were found.");
  }

  fs.writeFileSync(
    "words.json",
    JSON.stringify(words, null, 2)
  );

  console.log(`Successfully downloaded ${words.length} words!`);
  console.log("Saved to words.json");
}

downloadWords().catch(error => {
  console.error("Dictionary download failed:", error.message);
  process.exitCode = 1;
});