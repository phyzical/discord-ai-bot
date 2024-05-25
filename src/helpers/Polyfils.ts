// split text so it fits in a Discord message
export const splitText = (str: string, length: number): string[] => {
  // trim matches different characters to \s
  str = str
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^\s+|\s+$/g, '');
  const segments = [];
  let segment = '';
  let word, suffix;
  const appendSegment = (): void => {
    segment = segment.replace(/^\s+|\s+$/g, '');
    if (segment.length > 0) {
      segments.push(segment);
      segment = '';
    }
  };
  // match a word
  while ((word = str.match(/^[^\s]*(?:\s+|$)/)) != null) {
    suffix = '';
    word = word[0];
    if (word.length == 0) break;
    if (segment.length + word.length > length) {
      // prioritise splitting by newlines over other whitespaces
      if (segment.includes('\n')) {
        // append up all but last paragraph
        const beforeParagraph = segment.match(/^.*\n/s);
        if (beforeParagraph != null) {
          const lastParagraph = segment.substring(beforeParagraph[0].length, segment.length);
          segment = beforeParagraph[0];
          appendSegment();
          segment = lastParagraph;
          continue;
        }
      }
      appendSegment();
      // if word is larger than the split length
      if (word.length > length) {
        word = word.substring(0, length);
        if (length > 1 && word.match(/^[^\s]+$/)) {
          // try to hyphenate word
          word = word.substring(0, word.length - 1);
          suffix = '-';
        }
      }
    }
    str = str.substring(word.length, str.length);
    segment += word + suffix;
  }
  appendSegment();

  return segments;
};
