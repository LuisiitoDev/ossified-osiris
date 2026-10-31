/**
 * Read code exactly as rendered, including syntax-highlighted spans and
 * intentional indentation. Never copy the button label or surrounding prose.
 */
export function getCodeText(pre) {
  if (!pre) return '';
  const code = pre.querySelector?.('code');
  return code?.textContent ?? pre.textContent ?? '';
}
