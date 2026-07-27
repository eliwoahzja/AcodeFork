export interface LocalInlineCompletionContext {
	document: string;
	position: number;
	language?: string;
}

export interface LocalInlineCompletion {
	from: number;
	text: string;
}

interface AttributeTemplate {
	name: string;
	text: string;
}

const COMMON_ATTRIBUTES: AttributeTemplate[] = [
	{ name: "class", text: 'class=""' },
	{ name: "id", text: 'id=""' },
	{ name: "title", text: 'title=""' },
	{ name: "style", text: 'style=""' },
];

const TAG_ATTRIBUTES: Record<string, AttributeTemplate[]> = {
	a: [
		{ name: "href", text: 'href=""' },
		{ name: "target", text: 'target="_blank"' },
		{ name: "rel", text: 'rel="noopener noreferrer"' },
	],
	audio: [
		{ name: "src", text: 'src=""' },
		{ name: "controls", text: "controls" },
		{ name: "autoplay", text: "autoplay" },
		{ name: "loop", text: "loop" },
		{ name: "muted", text: "muted" },
	],
	button: [{ name: "type", text: 'type="button"' }],
	form: [
		{ name: "action", text: 'action=""' },
		{ name: "method", text: 'method="post"' },
	],
	iframe: [
		{ name: "src", text: 'src=""' },
		{ name: "title", text: 'title=""' },
		{ name: "width", text: 'width=""' },
		{ name: "height", text: 'height=""' },
	],
	img: [
		{ name: "src", text: 'src=""' },
		{ name: "alt", text: 'alt=""' },
		{ name: "width", text: 'width=""' },
		{ name: "height", text: 'height=""' },
	],
	input: [
		{ name: "type", text: 'type="text"' },
		{ name: "name", text: 'name=""' },
		{ name: "id", text: 'id=""' },
		{ name: "placeholder", text: 'placeholder=""' },
		{ name: "required", text: "required" },
	],
	label: [{ name: "for", text: 'for=""' }],
	link: [
		{ name: "rel", text: 'rel="stylesheet"' },
		{ name: "href", text: 'href=""' },
	],
	meta: [
		{ name: "name", text: 'name=""' },
		{ name: "content", text: 'content=""' },
	],
	script: [
		{ name: "src", text: 'src=""' },
		{ name: "type", text: 'type="module"' },
		{ name: "defer", text: "defer" },
	],
	select: [
		{ name: "name", text: 'name=""' },
		{ name: "id", text: 'id=""' },
		{ name: "multiple", text: "multiple" },
	],
	source: [
		{ name: "src", text: 'src=""' },
		{ name: "type", text: 'type=""' },
	],
	textarea: [
		{ name: "name", text: 'name=""' },
		{ name: "id", text: 'id=""' },
		{ name: "placeholder", text: 'placeholder=""' },
		{ name: "rows", text: 'rows=""' },
	],
	video: [
		{ name: "src", text: 'src=""' },
		{ name: "width", text: 'width=""' },
		{ name: "height", text: 'height=""' },
		{ name: "poster", text: 'poster=""' },
		{ name: "controls", text: "controls" },
		{ name: "autoplay", text: "autoplay" },
		{ name: "muted", text: "muted" },
		{ name: "loop", text: "loop" },
		{ name: "playsinline", text: "playsinline" },
	],
};

const TAG_TEMPLATES: Record<string, string> = {
	a: ' href=""></a>',
	audio: ' src="" controls></audio>',
	button: ' type="button"></button>',
	form: ' action="" method="post"></form>',
	iframe: ' src="" title=""></iframe>',
	img: ' src="" alt="">',
	input: ' type="text" name="" id="">',
	label: ' for=""></label>',
	link: ' rel="stylesheet" href="">',
	meta: ' name="" content="">',
	script: ' src="" defer></script>',
	select: ' name="" id=""></select>',
	source: ' src="" type="">',
	textarea: ' name="" id=""></textarea>',
	video: ' src="" width="" height="" controls></video>',
};

function isMarkupLanguage(language?: string): boolean {
	return /html|xml|svg|vue|svelte|jsx|tsx|react|angular|php|liquid|jinja/i.test(
		String(language || ""),
	);
}

function isCssLanguage(language?: string): boolean {
	return /css|scss|sass|less|stylus|postcss/i.test(String(language || ""));
}

function isJsLanguage(language?: string): boolean {
	return /\bjavascript\b|\bjs\b|\btypescript\b|\bts\b|\bjsx\b|\btsx\b|\bnode\b/i.test(
		String(language || ""),
	);
}

const CSS_PROPERTIES: { name: string; text: string }[] = [
	{ name: "color", text: "color: ;" },
	{ name: "background", text: "background: ;" },
	{ name: "background-color", text: "background-color: ;" },
	{ name: "background-image", text: "background-image: url();" },
	{ name: "display", text: "display: ;" },
	{ name: "flex", text: "flex: ;" },
	{ name: "flex-direction", text: "flex-direction: ;" },
	{ name: "flex-wrap", text: "flex-wrap: ;" },
	{ name: "flex-basis", text: "flex-basis: ;" },
	{ name: "flex-grow", text: "flex-grow: ;" },
	{ name: "flex-shrink", text: "flex-shrink: ;" },
	{ name: "justify-content", text: "justify-content: ;" },
	{ name: "align-items", text: "align-items: ;" },
	{ name: "align-content", text: "align-content: ;" },
	{ name: "align-self", text: "align-self: ;" },
	{ name: "gap", text: "gap: ;" },
	{ name: "row-gap", text: "row-gap: ;" },
	{ name: "column-gap", text: "column-gap: ;" },
	{ name: "grid", text: "grid: ;" },
	{ name: "grid-template-columns", text: "grid-template-columns: ;" },
	{ name: "grid-template-rows", text: "grid-template-rows: ;" },
	{ name: "grid-area", text: "grid-area: ;" },
	{ name: "grid-column", text: "grid-column: ;" },
	{ name: "grid-row", text: "grid-row: ;" },
	{ name: "margin", text: "margin: ;" },
	{ name: "margin-top", text: "margin-top: ;" },
	{ name: "margin-right", text: "margin-right: ;" },
	{ name: "margin-bottom", text: "margin-bottom: ;" },
	{ name: "margin-left", text: "margin-left: ;" },
	{ name: "padding", text: "padding: ;" },
	{ name: "padding-top", text: "padding-top: ;" },
	{ name: "padding-right", text: "padding-right: ;" },
	{ name: "padding-bottom", text: "padding-bottom: ;" },
	{ name: "padding-left", text: "padding-left: ;" },
	{ name: "border", text: "border: ;" },
	{ name: "border-radius", text: "border-radius: ;" },
	{ name: "border-color", text: "border-color: ;" },
	{ name: "border-style", text: "border-style: ;" },
	{ name: "border-width", text: "border-width: ;" },
	{ name: "width", text: "width: ;" },
	{ name: "height", text: "height: ;" },
	{ name: "min-width", text: "min-width: ;" },
	{ name: "min-height", text: "min-height: ;" },
	{ name: "max-width", text: "max-width: ;" },
	{ name: "max-height", text: "max-height: ;" },
	{ name: "position", text: "position: ;" },
	{ name: "top", text: "top: ;" },
	{ name: "right", text: "right: ;" },
	{ name: "bottom", text: "bottom: ;" },
	{ name: "left", text: "left: ;" },
	{ name: "z-index", text: "z-index: ;" },
	{ name: "font", text: "font: ;" },
	{ name: "font-family", text: "font-family: ;" },
	{ name: "font-size", text: "font-size: ;" },
	{ name: "font-weight", text: "font-weight: ;" },
	{ name: "font-style", text: "font-style: ;" },
	{ name: "line-height", text: "line-height: ;" },
	{ name: "letter-spacing", text: "letter-spacing: ;" },
	{ name: "text-align", text: "text-align: ;" },
	{ name: "text-decoration", text: "text-decoration: ;" },
	{ name: "text-transform", text: "text-transform: ;" },
	{ name: "text-overflow", text: "text-overflow: ;" },
	{ name: "white-space", text: "white-space: ;" },
	{ name: "overflow", text: "overflow: ;" },
	{ name: "overflow-x", text: "overflow-x: ;" },
	{ name: "overflow-y", text: "overflow-y: ;" },
	{ name: "opacity", text: "opacity: ;" },
	{ name: "visibility", text: "visibility: ;" },
	{ name: "cursor", text: "cursor: ;" },
	{ name: "transition", text: "transition: ;" },
	{ name: "transform", text: "transform: ;" },
	{ name: "animation", text: "animation: ;" },
	{ name: "box-shadow", text: "box-shadow: ;" },
	{ name: "box-sizing", text: "box-sizing: ;" },
	{ name: "outline", text: "outline: ;" },
	{ name: "object-fit", text: "object-fit: ;" },
	{ name: "object-position", text: "object-position: ;" },
	{ name: "filter", text: "filter: ;" },
	{ name: "backdrop-filter", text: "backdrop-filter: ;" },
	{ name: "aspect-ratio", text: "aspect-ratio: ;" },
	{ name: "content", text: "content: ;" },
	{ name: "list-style", text: "list-style: ;" },
	{ name: "list-style-type", text: "list-style-type: ;" },
	{ name: "vertical-align", text: "vertical-align: ;" },
	{ name: "user-select", text: "user-select: ;" },
	{ name: "pointer-events", text: "pointer-events: ;" },
	{ name: "resize", text: "resize: ;" },
	{ name: "appearance", text: "appearance: ;" },
];

const JS_SNIPPETS: { trigger: string; text: string }[] = [
	{ trigger: "cl", text: "console.log();" },
	{ trigger: "coe", text: "console.error();" },
	{ trigger: "cow", text: "console.warn();" },
	{ trigger: "fn", text: "function () {\n\t\n}" },
	{ trigger: "afn", text: "() => {\n\t\n}" },
	{ trigger: "iife", text: "(() => {\n\t\n})()" },
	{ trigger: "req", text: "const  = require('');" },
	{ trigger: "imp", text: "import  from '';" },
	{ trigger: "exp", text: "export default " },
	{ trigger: "expf", text: "export function () {}" },
	{ trigger: "class", text: "class  {\n\t\n}" },
	{ trigger: "tryc", text: "try {\n\t\n} catch (error) {\n\t\n}" },
	{ trigger: "tryf", text: "try {\n\t\n} finally {\n\t\n}" },
	{ trigger: "iff", text: "if () {\n\t\n}" },
	{ trigger: "ife", text: "if () {\n\t\n} else {\n\t\n}" },
	{ trigger: "for", text: "for (let i = 0; i < ; i++) {\n\t\n}" },
	{ trigger: "forof", text: "for (const  of ) {\n\t\n}" },
	{ trigger: "forin", text: "for (const  in ) {\n\t\n}" },
	{ trigger: "while", text: "while () {\n\t\n}" },
	{ trigger: "switch", text: "switch () {\n\t\n}" },
	{ trigger: "ternary", text: " ?  : " },
	{ trigger: "promise", text: "new Promise((resolve, reject) => {\n\t\n})" },
	{ trigger: "asyncf", text: "async () => {\n\t\n}" },
	{ trigger: "asyncc", text: "async function () {\n\t\n}" },
	{ trigger: "await", text: "await " },
	{ trigger: "return", text: "return " },
	{ trigger: "typeof", text: "typeof " },
	{ trigger: "instanceof", text: "instanceof " },
	{ trigger: "const", text: "const  = ;" },
	{ trigger: "let", text: "let  = ;" },
];

function getCssPropertyCompletion(fragment: string): string | null {
	const match = fragment.match(/([a-z-]+)$/i);
	if (!match) return null;
	const partial = match[1];
	if (/[:;{}()]/.test(fragment.slice(-1))) return null;
	const candidate = CSS_PROPERTIES.find((p) => p.name.startsWith(partial));
	if (!candidate) return null;
	if (candidate.name === partial) return null;
	return candidate.text.slice(partial.length);
}

function getJsSnippetCompletion(fragment: string): string | null {
	const match = fragment.match(/([a-zA-Z]+)$/);
	if (!match) return null;
	const partial = match[1];
	const candidate = JS_SNIPPETS.find((s) => s.trigger === partial);
	if (!candidate) return null;
	if (partial.length < 2) return null;
	return candidate.text.slice(partial.length);
}

function getUsedAttributes(fragment: string): Set<string> {
	const used = new Set<string>();
	const expression = /(?:^|\s)([A-Za-z_:][-A-Za-z0-9_:.]*)(?=\s*=|\s|$)/g;
	for (const match of fragment.matchAll(expression)) {
		used.add(match[1].toLowerCase());
	}
	return used;
}

function getAttributes(tag: string): AttributeTemplate[] {
	return [...(TAG_ATTRIBUTES[tag] || []), ...COMMON_ATTRIBUTES];
}

function getAttributeCompletion(tag: string, fragment: string): string | null {
	if (/=\s*$/.test(fragment)) return '""';
	if (/=\s*"$/.test(fragment) || /=\s*'$/.test(fragment)) return fragment.endsWith('"') ? '"' : "'";

	const partialMatch = fragment.match(/(?:^|\s)([A-Za-z_:][-A-Za-z0-9_:.]*)?$/);
	if (!partialMatch) return null;

	const partial = String(partialMatch[1] || "").toLowerCase();
	const used = getUsedAttributes(fragment);
	if (partial) used.delete(partial);

	const attribute = getAttributes(tag).find(
		(candidate) =>
			!used.has(candidate.name) && candidate.name.startsWith(partial),
	);
	if (!attribute) return null;
	return attribute.text.slice(partial.length);
}

export function getLocalInlineCompletion(
	context: LocalInlineCompletionContext,
): LocalInlineCompletion | null {
	const beforeCursor = context.document.slice(0, context.position);

	// CSS property completion
	if (isCssLanguage(context.language)) {
		const cssText = getCssPropertyCompletion(beforeCursor);
		if (cssText) return { from: context.position, text: cssText };
		return null;
	}

	// JS snippet completion (only triggers on word characters at line start or
	// after whitespace/operator boundaries — avoids interfering mid-expression).
	if (isJsLanguage(context.language)) {
		const jsText = getJsSnippetCompletion(beforeCursor);
		if (jsText) return { from: context.position, text: jsText };
		return null;
	}

	// HTML/markup tag/attribute completion (default, markup languages)
	const tagStart = beforeCursor.lastIndexOf("<");
	if (tagStart < 0 || tagStart < beforeCursor.lastIndexOf(">")) return null;

	const openTag = beforeCursor.slice(tagStart + 1);
	const tagMatch = openTag.match(/^([A-Za-z][\w:-]*)([\s\S]*)$/);
	if (!tagMatch || (!isMarkupLanguage(context.language) && !TAG_TEMPLATES[tagMatch[1].toLowerCase()])) {
		return null;
	}

	const tag = tagMatch[1].toLowerCase();
	const attributes = tagMatch[2];
	if (!attributes) {
		const template = TAG_TEMPLATES[tag];
		return template ? { from: context.position, text: template } : null;
	}

	const text = getAttributeCompletion(tag, attributes);
	return text ? { from: context.position, text } : null;
}
