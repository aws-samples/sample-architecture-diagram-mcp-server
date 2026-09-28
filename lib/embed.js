// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Safe embedding of the diagram data into the generated single-file HTML.

/** JSON literal safe to inline inside a `<script type="application/json">`
 *  block. `<` is written as its \\u003c escape — still valid JSON, and JSON.parse
 *  turns it back into `<` — so an author string containing `</script>` (or
 *  `<!--`) can no longer close the block early, which would truncate the data
 *  and splice the rest of the text into the DOM as markup.
 *
 *  Pass the result to String.replace through a replacer FUNCTION, never as the
 *  replacement string: in a replacement string `$&`, '$`' and `$'` are patterns,
 *  so a step description mentioning `$&` would splice template text into the
 *  data. `embedJson` cannot defend against that on its own.
 */
export function embedJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** `.replace(needle, inject(value))` — the two guards above, together. */
export function inject(value) {
  const json = embedJson(value);
  return () => json;
}
