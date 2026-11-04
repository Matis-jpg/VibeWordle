const fs = require("fs");

const URL = "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt";
const ALLOWED_LENGTHS = new Set([5, 6, 7]);

async function downloadWords() {
  console.log("Downloading English dictionary...");
  const response = await fetch(URL);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);

  const text = await response.text();
  const words = [
    ...new Set(
      text.split(/\r?\n/)
        .map(word => word.trim().toUpperCase())
        .filter(word => /^[A-Z]+$/.test(word) && ALLOWED_LENGTHS.has(word.length))
    )
  ].sort();

  for (const length of ALLOWED_LENGTHS) {
    const count = words.filter(word => word.length === length).length;
    if (!count) throw new Error(`No ${length}-letter words were found.`);
    console.log(`${length}-letter words: ${count}`);
  }

  fs.writeFileSync("words.json", JSON.stringify(words, null, 2));
  console.log(`Successfully saved ${words.length} words to words.json`);
}

downloadWords().catch(error => {
  console.error("Dictionary download failed:", error.message);
  process.exitCode = 1;
});
