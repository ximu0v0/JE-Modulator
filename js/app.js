import { KEYS, wrapDelta, convert, pitchRange } from "./je.js";

const sourceSelect = document.querySelector("#source-key");
const targetSelect = document.querySelector("#target-key");
const spellingSelect = document.querySelector("#spelling");
const inputEl = document.querySelector("#input");
const outputEl = document.querySelector("#output");
const statusEl = document.querySelector("#status");
const rangeInfoEl = document.querySelector("#range-info");
const rangeResultEl = document.querySelector("#range-result");
const offsetInfoEl = document.querySelector("#offset-info");
const swapBtn = document.querySelector("#swap");
const shiftUpBtn = document.querySelector("#shift-up");
const shiftDownBtn = document.querySelector("#shift-down");
const exampleBtn = document.querySelector("#example");
const clearBtn = document.querySelector("#clear");
const copyBtn = document.querySelector("#copy");

const EXAMPLE = "#4 b7 | 1 2 3 4\n(6 7) [1 2] #5";

/** ±1 半音按钮累计的额外升降（与调性换算叠加）。 */
let extraShift = 0;

for (const [index, key] of KEYS.entries()) {
  for (const select of [sourceSelect, targetSelect]) {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `1=${key}`;
    select.append(option);
  }
}

sourceSelect.value = "0";
targetSelect.value = "2";

function formatSigned(n) {
  return n > 0 ? `+${n}` : String(n);
}

function render() {
  const from = Number(sourceSelect.value);
  const to = Number(targetSelect.value);

  // 固定调记谱：换调即整份谱整体升/降（目标调 − 原调）半音
  const shift = wrapDelta(from, to) + extraShift;
  const result = convert(inputEl.value, shift, spellingSelect.value);

  outputEl.value = result.text;
  statusEl.textContent = `1=${KEYS[from]} → 1=${KEYS[to]} · 整体 ${formatSigned(shift)} 半音`;

  const range = pitchRange(inputEl.value);
  rangeInfoEl.textContent = range
    ? `最低音 ${range.min} · 最高音 ${range.max}`
    : "最低音 — · 最高音 —";

  const resultRange = pitchRange(result.text);
  rangeResultEl.textContent = resultRange
    ? `最低音 ${resultRange.min} · 最高音 ${resultRange.max}`
    : "最低音 — · 最高音 —";

  offsetInfoEl.textContent = `音高 ${shift === 0 ? "不变" : `${formatSigned(shift)} 半音`}`;
}

function resetShiftAndRender() {
  extraShift = 0;
  render();
}

sourceSelect.addEventListener("change", resetShiftAndRender);
targetSelect.addEventListener("change", resetShiftAndRender);
spellingSelect.addEventListener("change", render);
inputEl.addEventListener("input", render);

swapBtn.addEventListener("click", () => {
  const from = sourceSelect.value;
  sourceSelect.value = targetSelect.value;
  targetSelect.value = from;
  resetShiftAndRender();
});

shiftUpBtn.addEventListener("click", () => {
  extraShift += 1;
  render();
});

shiftDownBtn.addEventListener("click", () => {
  extraShift -= 1;
  render();
});

exampleBtn.addEventListener("click", () => {
  inputEl.value = EXAMPLE;
  resetShiftAndRender();
  inputEl.focus();
});

clearBtn.addEventListener("click", () => {
  inputEl.value = "";
  resetShiftAndRender();
  inputEl.focus();
});

copyBtn.addEventListener("click", async () => {
  if (!outputEl.value) return;
  try {
    await navigator.clipboard.writeText(outputEl.value);
  } catch {
    outputEl.select();
    document.execCommand("copy");
    window.getSelection()?.removeAllRanges();
  }
  const original = copyBtn.textContent;
  copyBtn.textContent = "已复制";
  setTimeout(() => {
    copyBtn.textContent = original;
  }, 1200);
});

inputEl.value = EXAMPLE;
render();
