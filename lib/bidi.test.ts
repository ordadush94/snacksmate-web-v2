import assert from "node:assert/strict";
import test from "node:test";
import { isLatinParenthetical, splitLatinParentheticals } from "./bidi";

test("splits a Latin parenthetical out of a Hebrew sentence", () => {
  const source =
    "Snacksmate קוראת מחקרים מדעיים על חטיפי תנועה (Exercise Snacks) ומסבירה אותם בשפה פשוטה.";
  const parts = splitLatinParentheticals(source);
  assert.deepEqual(parts, [
    "Snacksmate קוראת מחקרים מדעיים על חטיפי תנועה ",
    "(Exercise Snacks)",
    " ומסבירה אותם בשפה פשוטה.",
  ]);
  assert.equal(isLatinParenthetical("(Exercise Snacks)"), true);
  assert.equal(isLatinParenthetical(parts[0] ?? ""), false);
});

test("leaves Hebrew without a Latin parenthetical as one part", () => {
  const source = "חטיפי תנועה של 2-5 דקות, בלי ציוד, בכל מקום.";
  assert.deepEqual(splitLatinParentheticals(source), [source]);
});
