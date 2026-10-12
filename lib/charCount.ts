const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });
const SPACE = /^\s+$/u;

/** 사람이 보기에 한 글자(문자소) 단위로 센다. 띄어쓰기·줄바꿈·탭은 공백 제외 개수에서 뺀다. */
export function countChars(text: string): { total: number; nonSpace: number } {
  let total = 0;
  let nonSpace = 0;
  for (const { segment } of segmenter.segment(text)) {
    total++;
    if (!SPACE.test(segment)) nonSpace++;
  }
  return { total, nonSpace };
}
