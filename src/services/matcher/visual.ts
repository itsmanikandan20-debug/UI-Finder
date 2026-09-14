// "Visual similarity" bucket — deliberately swappable.
//
// A real pixel/perceptual visual signal (screenshot embeddings, a
// CLIP-style model) needs an ML provider we don't want to hard-wire the
// whole app to (see README + architecture notes on not depending on one
// paid API). Until one is plugged in, this bucket uses a free, honest
// proxy: how similar is the image/text CONTENT MIX and its distribution
// across leaves — not real pixels. It is labeled as a proxy everywhere
// it surfaces so the score never overclaims "visual" matching it isn't
// doing yet.

import type { LayoutNode } from "@/lib/layout/types";
import { ratioSimilarity } from "./util";

export type VisualSimilarityProvider = (a: LayoutNode, b: LayoutNode) => number;

interface LeafMix {
  total: number;
  images: number;
  text: number;
}

function leafMix(node: LayoutNode, out: LeafMix): void {
  if (node.children.length === 0) {
    out.total += 1;
    if (node.meta?.hasImage) out.images += 1;
    if (node.meta?.hasText) out.text += 1;
    return;
  }
  for (const child of node.children) leafMix(child, out);
}

export const contentMixProxyProvider: VisualSimilarityProvider = (a, b) => {
  const mixA: LeafMix = { total: 0, images: 0, text: 0 };
  const mixB: LeafMix = { total: 0, images: 0, text: 0 };
  leafMix(a, mixA);
  leafMix(b, mixB);

  const imageRatioA = mixA.total > 0 ? mixA.images / mixA.total : 0;
  const imageRatioB = mixB.total > 0 ? mixB.images / mixB.total : 0;
  const textRatioA = mixA.total > 0 ? mixA.text / mixA.total : 0;
  const textRatioB = mixB.total > 0 ? mixB.text / mixB.total : 0;

  const imageScore = ratioSimilarity(imageRatioA, imageRatioB);
  const textScore = ratioSimilarity(textRatioA, textRatioB);
  const aspectA = a.width / (a.height || 1e-6);
  const aspectB = b.width / (b.height || 1e-6);
  const aspectScore = ratioSimilarity(aspectA, aspectB);

  return 0.4 * imageScore + 0.3 * textScore + 0.3 * aspectScore;
};
