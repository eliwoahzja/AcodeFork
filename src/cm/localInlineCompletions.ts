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
