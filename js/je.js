export const KEYS = [
  "C", "#C", "D", "#D", "E", "F", "#F", "G", "#G", "A", "#A", "B",
];

const DEGREE_BASE = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
const NATURAL_NAMES = { 0: "1", 2: "2", 4: "3", 5: "4", 7: "5", 9: "6", 11: "7" };
const SHARP_NAMES = { 1: "#1", 3: "#2", 6: "#4", 8: "#5", 10: "#6" };
const FLAT_NAMES = { 1: "b2", 3: "b3", 6: "b5", 8: "b6", 10: "b7" };

export function keyLabel(index) {
  return `1=${KEYS[index]}`;
}

/** 把任意整数半音距离折算到最近的 [-6, +6] 区间。 */
export function wrapDelta(fromIndex, toIndex) {
  const raw = (((toIndex - fromIndex) % 12) + 12) % 12;
  return raw > 6 ? raw - 12 : raw;
}

function openFor(level) {
  return level > 0 ? "[".repeat(level) : "(".repeat(-level);
}

function closeFor(level) {
  return level > 0 ? "]".repeat(level) : ")".repeat(-level);
}

function spell(semitone, preferFlat) {
  if (semitone in NATURAL_NAMES) return NATURAL_NAMES[semitone];
  return preferFlat ? FLAT_NAMES[semitone] : SHARP_NAMES[semitone];
}

/** 顺序扫描文本中的 JE 音符，返回 [{ degree, accidental, level, raw }]。 */
export function scanNotes(text) {
  const notes = [];
  let level = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "[" || ch === "【") { level += 1; i += 1; continue; }
    if (ch === "(" || ch === "（") { level -= 1; i += 1; continue; }
    if (ch === "]" || ch === "】") { level -= 1; i += 1; continue; }
    if (ch === ")" || ch === "）") { level += 1; i += 1; continue; }

    let accidental = 0;
    let mark = "";
    if ((ch === "#" || ch === "b") && /[1-7]/.test(text[i + 1] || "")) {
      accidental = ch === "#" ? 1 : -1;
      mark = ch;
      i += 1;
    }
    const digit = text[i];
    if (digit >= "1" && digit <= "7") {
      notes.push({ degree: Number(digit), accidental, level, raw: mark + digit });
      i += 1;
      continue;
    }
    i += 1;
  }
  return notes;
}

/**
 * 固定调记谱下整体升降：把谱面所有音符按绝对音高平移 shift 个半音，
 * 并按拼写规则重排等音与八度括号。非音符字符原样保留。
 *
 * @param {string} text JE 谱文本
 * @param {number} shift 整体升降的半音数
 * @param {"follow"|"sharp"|"flat"} spelling 临时记号偏好
 * @param {boolean} merge 是否合并相邻同层括号（默认 false，保留原谱分组）
 * @returns {{text: string, shift: number}}
 */
export function convert(text, shift, spelling = "follow", merge = false) {
  let out = "";
  let inputLevel = 0;
  let openLevel = 0;
  let lastNoteEnd = 0;
  let i = 0;

  // 不合并模式下按输入分组追踪输出括号：
  // 每层记录 { sign, ib }，ib = 打开该层时输入侧同族括号的未闭合数量，
  // ib = 0 表示该层由八度进位产生（无输入括号背书），遇到新输入分组时立即闭合。
  const inputOpen = { high: 0, low: 0 };
  const openStack = [];

  /** 闭合括号紧贴最后一个音符之后，不把中间的歌词、小节线包进去。 */
  function closeBrackets(count) {
    if (count === 0) return;
    const close = closeFor(count);
    out = out.slice(0, lastNoteEnd) + close + out.slice(lastNoteEnd);
    lastNoteEnd += close.length;
    openLevel -= count;
    for (let k = 0; k < Math.abs(count); k += 1) openStack.pop();
  }

  function pushLayers(count, sign) {
    for (let k = 0; k < count; k += 1) {
      openStack.push({ sign, ib: sign > 0 ? inputOpen.high : inputOpen.low });
    }
  }

  /** 栈顶连续的、满足条件的同族括号层数。 */
  function topLayers(sign, pred) {
    let n = 0;
    for (let k = openStack.length - 1; k >= 0; k -= 1) {
      const layer = openStack[k];
      if (layer.sign !== sign || !pred(layer)) break;
      n += 1;
    }
    return n;
  }

  while (i < text.length) {
    const ch = text[i];

    if (ch === "[" || ch === "【") {
      inputLevel += 1;
      if (!merge) {
        // 新输入分组开始前，闭合悬空的进位括号，避免与本组共用括号
        closeBrackets(topLayers(1, (layer) => layer.ib === 0));
        inputOpen.high += 1;
      }
      i += 1; continue;
    }
    if (ch === "(" || ch === "（") {
      inputLevel -= 1;
      if (!merge) {
        closeBrackets(-topLayers(-1, (layer) => layer.ib === 0));
        inputOpen.low += 1;
      }
      i += 1; continue;
    }
    if (ch === "]" || ch === "】") {
      inputLevel -= 1;
      if (!merge) {
        // 只闭合属于本输入组的输出括号层，保留外层嵌套分组
        closeBrackets(topLayers(1, (layer) => layer.ib === inputOpen.high));
        if (inputOpen.high > 0) inputOpen.high -= 1;
      }
      i += 1; continue;
    }
    if (ch === ")" || ch === "）") {
      inputLevel += 1;
      if (!merge) {
        closeBrackets(-topLayers(-1, (layer) => layer.ib === inputOpen.low));
        if (inputOpen.low > 0) inputOpen.low -= 1;
      }
      i += 1; continue;
    }

    let accidental = 0;
    if ((ch === "#" || ch === "b") && /[1-7]/.test(text[i + 1] || "")) {
      accidental = ch === "#" ? 1 : -1;
      i += 1;
    }

    const digit = text[i];
    if (digit >= "1" && digit <= "7") {
      const relative = DEGREE_BASE[Number(digit)] + accidental + shift;
      const carry = Math.floor(relative / 12);
      const semitone = ((relative % 12) + 12) % 12;
      const preferFlat = spelling === "flat" || (spelling === "follow" && accidental < 0);

      const level = inputLevel + carry;
      if (level !== openLevel) {
        if (Math.sign(level) === Math.sign(openLevel) || level === 0 || openLevel === 0) {
          if (Math.abs(level) > Math.abs(openLevel)) {
            const sign = Math.sign(level);
            pushLayers(Math.abs(level) - Math.abs(openLevel), sign);
            out += openFor(level - openLevel);
          } else {
            closeBrackets(openLevel - level);
          }
        } else {
          closeBrackets(openLevel);
          pushLayers(Math.abs(level), Math.sign(level));
          out += openFor(level);
        }
        openLevel = level;
      }

      out += spell(semitone, preferFlat);
      lastNoteEnd = out.length;
      i += 1;
      continue;
    }

    if (ch === "\n") {
      closeBrackets(openLevel);
      openLevel = 0;
    }
    out += ch;
    i += 1;
  }

  closeBrackets(openLevel);

  return { text: out, shift };
}

/**
 * 转调（固定调记谱）：原调 fromIndex → 目标调 toIndex。
 * JE 谱的数字对应绝对音高（1=C 恒定），换调即整份谱整体升/降半音，
 * 平移量 = 两调之间的最近半音距离（目标 − 原调）。
 */
export function transpose(text, fromIndex, toIndex, spelling = "follow", merge = false) {
  const shift = wrapDelta(fromIndex, toIndex);
  return convert(text, shift, spelling, merge);
}

/**
 * 统计谱面的最低音 / 最高音（固定调，与调无关）。
 * @returns {{min: string, max: string} | null} 无音符时返回 null
 */
export function pitchRange(text) {
  const notes = scanNotes(text);
  if (notes.length === 0) return null;

  let min = null;
  let max = null;
  for (const note of notes) {
    const abs = note.level * 12 + DEGREE_BASE[note.degree] + note.accidental;
    const label = openFor(note.level) + note.raw + closeFor(note.level);
    if (!min || abs < min.abs) min = { abs, label };
    if (!max || abs > max.abs) max = { abs, label };
  }
  return { min: min.label, max: max.label };
}

