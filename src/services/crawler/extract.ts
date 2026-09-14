// Runs inside the page (via page.evaluate) to walk the rendered DOM and
// produce a plain, JSON-serializable tree of geometry + a few cheap
// content signals. Deliberately does NOT try to classify anything as a
// "hero" or "pricing table" here — that would smuggle keyword-shaped
// thinking back into the one place we're trying hardest to keep it out.
// It only reports what's actually rendered: boxes, whether something is
// an image, whether it carries its own text.
//
// This is passed to page.evaluate() as a raw source STRING rather than a
// JS function object. Passing a function works fine with plain `tsc`,
// but under esbuild-based runners (tsx, and Next's own dev/build
// pipeline) with keepNames enabled, every function — including plain
// arrow functions — gets wrapped in a `__name(fn, "name")` call for
// preserving `.name`. Playwright ships a function to the browser via its
// serialized source (`fn.toString()`), and the browser has no idea what
// `__name` is, so it throws ReferenceError before the script ever runs.
// A string is evaluated by the browser's own JS engine untouched by any
// bundler, sidestepping the problem entirely.

import type { Page } from "playwright";

export interface RawDomNode {
  tag: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isImage: boolean;
  hasOwnText: boolean;
  children: RawDomNode[];
}

const MAX_DEPTH = 10;
const MAX_BREADTH = 80;

function extractScript(maxDepth: number, maxBreadth: number): string {
  return `
    (function () {
      var HARD_SKIP = { script: 1, style: 1, noscript: 1, template: 1, link: 1, meta: 1 };
      var maxDepth = ${maxDepth};
      var maxBreadth = ${maxBreadth};

      function isVisible(el) {
        var style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (parseFloat(style.opacity || "1") === 0) return false;
        var rect = el.getBoundingClientRect();
        return rect.width >= 4 && rect.height >= 4;
      }

      function walk(el, depth) {
        var tag = el.tagName.toLowerCase();
        if (HARD_SKIP[tag]) return null;
        if (!isVisible(el)) return null;

        var rect = el.getBoundingClientRect();
        var style = window.getComputedStyle(el);
        var isImage =
          tag === "img" ||
          tag === "picture" ||
          tag === "svg" ||
          tag === "video" ||
          tag === "canvas" ||
          (!!style.backgroundImage && style.backgroundImage !== "none");
        var hasOwnText = Array.prototype.some.call(el.childNodes, function (n) {
          return n.nodeType === 3 && !!n.textContent && n.textContent.trim().length > 0;
        });

        var childEls = tag === "svg" ? [] : Array.prototype.filter.call(el.children, function (c) {
          return !HARD_SKIP[c.tagName.toLowerCase()];
        });

        if (depth >= maxDepth || childEls.length > maxBreadth) {
          childEls = [];
        }

        var children = [];
        for (var i = 0; i < childEls.length; i++) {
          var node = walk(childEls[i], depth + 1);
          if (node) children.push(node);
        }

        // Collapse a pass-through wrapper (one child, no content of its
        // own, occupying nearly the same box) — very common in framework
        // output (#root, #__next, generic layout <div>s) and structurally
        // meaningless noise if kept.
        if (children.length === 1 && !hasOwnText && !isImage) {
          var only = children[0];
          var overlapW = Math.min(rect.width, only.width) / Math.max(rect.width, only.width, 1);
          var overlapH = Math.min(rect.height, only.height) / Math.max(rect.height, only.height, 1);
          if (overlapW > 0.92 && overlapH > 0.92) {
            return only;
          }
        }

        return {
          tag: tag,
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
          isImage: !!isImage,
          hasOwnText: hasOwnText,
          children: children
        };
      }

      return walk(document.body, 0);
    })()
  `;
}

export async function extractRenderedTree(page: Page): Promise<RawDomNode | null> {
  return page.evaluate(extractScript(MAX_DEPTH, MAX_BREADTH)) as Promise<RawDomNode | null>;
}
