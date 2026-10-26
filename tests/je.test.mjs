import assert from "node:assert/strict";
import {
  KEYS,
  keyLabel,
  wrapDelta,
  convert,
  transpose,
  pitchRange,
} from "../js/je.js";

const C = 0;
const CS = 1;
const D = 2;
const E = 4;

// ---------- transpose：固定调记谱，换调 = 整体升/降半音 ----------

const cases = [
  {
    name: "C→C 恒等输出",
    actual: transpose("1 2 3 #4 b7", C, C),
    expected: "1 2 3 #4 b7",
    shift: 0,
  },
  {
    name: "C→#C：145 整体升半音",
    actual: transpose("145", C, CS),
    expected: "#1#4#5",
    shift: 1,
  },
  {
    name: "C→#C：(7)3#4 升半音后为 145",
    actual: transpose("(7)3#4", C, CS),
    expected: "145",
    shift: 1,
  },
  {
    name: "C→#C：带空格谱面",
    actual: transpose("1 2 3", C, CS),
    expected: "#1 #2 4",
    shift: 1,
  },
  {
    name: "C→D：整体升 2 半音",
    actual: transpose("1 2 3", C, D),
    expected: "2 3 #4",
    shift: 2,
  },
  {
    name: "E→C：整体降 4 半音",
    actual: transpose("1 2 3", E, C),
    expected: "(#5 #6) 1",
    shift: -4,
  },
  {
    name: "嵌套八度括号随音高重排",
    actual: transpose("(1 2)[3]", C, CS),
    expected: "(#1 #2)[4]",
    shift: 1,
  },
  {
    name: "b1 升半音回到 1",
    actual: transpose("b1", C, CS),
    expected: "1",
    shift: 1,
  },
  {
    name: "#7 升半音进高八度",
    actual: transpose("#7", C, CS),
    expected: "[#1]",
    shift: 1,
  },
  {
    name: "b3 升半音为自然 3",
    actual: transpose("b3", C, CS),
    expected: "3",
    shift: 1,
  },
  {
    name: "#2 升 2 半音为 4",
    actual: transpose("#2", C, D),
    expected: "4",
    shift: 2,
  },
  {
    name: "默认不合并相邻同层括号（C→C）",
    actual: transpose("[1] [2]", C, C),
    expected: "[1] [2]",
    shift: 0,
  },
  {
    name: "非音符字符原样保留（C→C）",
    actual: transpose("1 2 3\n歌词 la la | 4", C, C),
    expected: "1 2 3\n歌词 la la | 4",
    shift: 0,
  },
  {
    name: "【 】等价 [ ]（C→C 归一为标准括号）",
    actual: transpose("【1 2】 3", C, C),
    expected: "[1 2] 3",
    shift: 0,
  },
  {
    name: "进位括号不与后续分组共用（C→D 不合并）",
    actual: transpose("#4#5#6 【#2】【#1】", C, D),
    expected: "#5#6[1] [4][#2]",
    shift: 2,
  },
  {
    name: "进位括号与后续分组合并（C→D 开启合并）",
    actual: transpose("#4#5#6 【#2】【#1】", C, D, "follow", true),
    expected: "#5#6[1 4#2]",
    shift: 2,
  },
  {
    name: "嵌套分组闭括号不破坏外层（不合并）",
    actual: transpose("【1 [3] 5】", C, CS),
    expected: "[#1 [4] #5]",
    shift: 1,
  },
  {
    name: "全角括号（ ）等价 ( )（C→#C）",
    actual: transpose("（1）", C, CS),
    expected: "(#1)",
    shift: 1,
  },
  {
    name: "全角半角括号混用整行（C→D）",
    actual: transpose("(#4)(#5)(#6)(#4) #2#1#2（#4）#3#2#3", C, D),
    expected: "(#5)(#6)1(#5) 4#24(#5)545",
    shift: 2,
  },
];

let failed = 0;

for (const item of cases) {
  try {
    assert.equal(item.actual.text, item.expected, `${item.name} 文本`);
    assert.equal(item.actual.shift, item.shift, `${item.name} 平移量`);
    console.log(`  ok  ${item.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${item.name}`);
    console.error(`      ${error.message}`);
  }
}

// ---------- convert：直接指定半音偏移 ----------

try {
  assert.equal(convert("145", 1).text, "#1#4#5");
  assert.equal(convert("145", -1).text, "(7)3#4");
  assert.equal(convert("145", 1).shift, 1);
  console.log("  ok  convert 直接升降半音");
} catch (error) {
  failed += 1;
  console.error("FAIL  convert 直接升降半音");
  console.error(`      ${error.message}`);
}

// ---------- merge：合并相邻同层括号（默认关闭） ----------

try {
  assert.equal(transpose("[1] [2]", C, C, "follow", true).text, "[1 2]", "开启后合并");
  assert.equal(transpose("[1] [2]", C, C, "follow", false).text, "[1] [2]", "关闭时保留分组");
  assert.equal(transpose("(1) (2)", C, C, "follow", true).text, "(1 2)", "低八度同样合并");
  assert.equal(transpose("【1】 【2】", C, C, "follow", true).text, "[1 2]", "【 】分组也可合并");
  console.log("  ok  merge 开关控制括号合并");
} catch (error) {
  failed += 1;
  console.error("FAIL  merge 开关控制括号合并");
  console.error(`      ${error.message}`);
}

// ---------- pitchRange：固定调音域 ----------

try {
  assert.deepEqual(pitchRange("(1) 5 [3]"), { min: "(1)", max: "[3]" });
  assert.deepEqual(pitchRange("145"), { min: "1", max: "5" });
  assert.deepEqual(pitchRange("5 【3】"), { min: "5", max: "[3]" }, "【 】参与音域统计");
  assert.deepEqual(pitchRange("（1） 5"), { min: "(1)", max: "5" }, "（ ）参与音域统计");
  assert.equal(pitchRange("没有音符"), null);
  console.log("  ok  pitchRange 最低/最高音");
} catch (error) {
  failed += 1;
  console.error("FAIL  pitchRange 最低/最高音");
  console.error(`      ${error.message}`);
}

// ---------- 工具函数 ----------

try {
  assert.equal(wrapDelta(0, 7), -5, "C→G 应取 -5 半音");
  assert.equal(wrapDelta(0, 11), -1, "C→B 应取 -1 半音");
  assert.equal(wrapDelta(11, 0), 1, "B→C 应取 +1 半音");
  assert.equal(wrapDelta(0, 1), 1, "C→#C 应取 +1 半音");
  assert.equal(keyLabel(2), "1=D");
  assert.equal(KEYS.length, 12);
  console.log("  ok  wrapDelta / keyLabel / KEYS");
} catch (error) {
  failed += 1;
  console.error("FAIL  wrapDelta / keyLabel / KEYS");
  console.error(`      ${error.message}`);
}

if (failed > 0) {
  console.error(`\n${failed} 个用例失败`);
  process.exit(1);
}

console.log("\n全部用例通过");
