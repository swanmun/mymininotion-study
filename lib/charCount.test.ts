import { describe, expect, it } from "vitest";
import { countChars } from "./charCount";

// 기대값은 contracts/char-count.md 1절 표를 손으로 센 리터럴이다.
describe("countChars", () => {
  it.each([
    ["", 0, 0],
    ["안녕 하세요", 6, 5],
    ["가 나\n다", 5, 3],
    ["   ", 3, 0],
    ["a\tb", 3, 2],
    ["a\r\nb", 3, 2],
    ["👍🏽🇰🇷", 2, 2],
    ["é", 1, 1],
    ["한글", 2, 2],
  ])("%j는 공백 포함 %i자, 공백 제외 %i자", (text, total, nonSpace) => {
    expect(countChars(text)).toEqual({ total, nonSpace });
  });
});
