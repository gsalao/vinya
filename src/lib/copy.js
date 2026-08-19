import content from './content.generated.json';

/** Alt+Enter inside a spreadsheet cell, or a blank line, both mean "new
 *  paragraph". Split on any run of newlines so the owner does not have to know
 *  which one the build wants. */
export const paras = (s) =>
	String(s ?? '')
		.split(/\r?\n\s*\r?\n|\r?\n/)
		.map((p) => p.trim())
		.filter(Boolean);

/** Named `txt` rather than `t` or `c`: both of those are already loop variables
 *  in the markup, and copy-manifest.test.js finds keys by grepping for this name.
 *
 *  Throwing on an unknown key is deliberate. The alternative — returning '' — is
 *  how a deleted spreadsheet row silently blanks a headline on a live page. */
export function txt(key) {
	const value = content.copy[key];
	if (value === undefined) {
		throw new Error(`copy: no such key "${key}". Add a row to the copy tab, or fix the markup.`);
	}
	return value;
}
