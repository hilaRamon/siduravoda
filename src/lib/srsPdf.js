/**
 * Where each PDF page of one captured chapter ends.
 * Cuts sit in blank pixel rows, so a line of text is never split.
 * A short line with a large gap above it (a heading) moves to the next page
 * together with the text under it.
 */
export function chooseSliceEnds({ height, pageHeight, isTextRow }) {
  const cuts = [];
  let start = 0;
  let guard = 0;
  const textAt = (y) => y >= 0 && y < height && isTextRow(Math.floor(y));

  while (start < height - 1 && guard < 500) {
    guard += 1;
    const limit = Math.min(height, start + pageHeight);
    if (limit >= height - 1) {
      cuts.push(height);
      break;
    }
    let textAfterLimit = false;
    for (let probe = limit; probe < height; probe += 1) {
      if (textAt(probe)) {
        textAfterLimit = true;
        break;
      }
    }
    if (!textAfterLimit) {
      cuts.push(height);
      break;
    }

    let cut = limit;
    for (let y = limit - 1; y > start + 24; y -= 1) {
      if (textAt(y)) continue;

      let gapBottom = y;
      while (gapBottom + 1 < limit && !textAt(gapBottom + 1)) gapBottom += 1;
      const contentStart = gapBottom + 1;

      let gapTop = y;
      while (gapTop - 1 > start && !textAt(gapTop - 1)) gapTop -= 1;

      let runBottom = gapTop - 1;
      let runTop = runBottom;
      while (runTop > start && textAt(runTop - 1)) runTop -= 1;
      const runHeight = runBottom >= runTop ? runBottom - runTop + 1 : 0;

      let blankAbove = 0;
      for (let probe = runTop - 1; probe > start && !textAt(probe); probe -= 1) {
        blankAbove += 1;
      }

      const gapSize = Math.max(1, contentStart - gapTop);
      const cushion = Math.min(6, Math.floor(gapSize / 2));
      let breakAt = contentStart - cushion;
      if (runHeight > 0 && runHeight <= 42 && blankAbove >= 24 && runTop - 2 > start + 24) {
        breakAt = runTop - 2;
      }

      cut = Math.max(start + 1, Math.min(limit - 1, breakAt));
      break;
    }

    if (cut <= start) cut = limit;
    cuts.push(Math.min(cut, height));
    start = cut;
  }

  if (!cuts.length || cuts[cuts.length - 1] < height - 1) cuts.push(height);
  return cuts;
}
