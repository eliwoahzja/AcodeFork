import {
	CompletionList,
	type CompletionSource,
	type CompletionContext,
} from "@codemirror/autocomplete";
import { EditorState, type Extension } from "@codemirror/state";

const HTML_TAGS = [
	"a", "abbr", "address", "area", "article", "aside", "audio",
	"b", "base", "bdi", "bdo", "blockquote", "body", "br", "button",
	"canvas", "caption", "cite", "code", "col", "colgroup",
	"data", "datalist", "dd", "del", "details", "dfn", "dialog", "div", "dl", "dt",
	"em", "embed",
	"fieldset", "figure", "footer", "form",
	"h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html",
	"i", "iframe", "img", "input", "ins",
	"kbd",
	"label", "legend", "li", "link",
	"main", "map", "mark", "menu", "meta", "meter",
	"nav", "noscript",
	"object", "ol", "optgroup", "option", "output",
	"p", "param", "picture", "pre", "progress",
	"q",
	"rp", "rt", "ruby",
	"s", "samp", "script", "section", "select", "slot", "small", "source", "span",
	"strong", "style", "sub", "summary", "sup",
	"table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time",
	"title", "tr", "track",
	"u", "ul",
	"var", "video",
	"wbr",
];

const VOID_TAGS = new Set([
	"area", "base", "br", "col", "embed", "hr", "img", "input",
	"link", "meta", "param", "source", "track", "wbr",
]);

const HTML_ATTRIBUTES = [
	"class", "id", "style", "title", "hidden", "tabindex", "contenteditable",
	"dir", "lang", "draggable", "spellcheck", "translate",
	"accesskey", "autocapitalize", "autocorrect", "autofocus", "autocomplete",
	"inputmode", "is",
	"data-*",
	"src", "href", "type", "name", "value", "placeholder", "required",
	"disabled", "readonly", "checked", "selected", "multiple",
	"min", "max", "step", "minlength", "maxlength", "pattern",
	"rows", "cols", "wrap", "autocomplete", "autofocus", "list", "form",
	"width", "height", "alt", "loading", "decoding", "fetchpriority",
	"srcset", "sizes", "crossorigin", "referrerpolicy", "usemap", "ismap",
	"for", "formaction", "formenctype", "formmethod", "formnovalidate",
	"formtarget", "async", "defer", "integrity", "nonce",
	"target", "download", "rel", "hreflang", "media", "as", "color",
	"charset", "http-equiv", "content", "scheme",
	"span", "scope", "headers", "colspan", "rowspan",
	"open", "reversed", "start",
	"datetime", "cite", "controls", "controlslist", "loop", "muted",
	"preload", "kind", "srclang", "label", "default",
	"action", "method", "enctype", "novalidate",
	"role", "aria-*",
];

function getTagAttributes(tag: string): string[] {
	const baseAttrs = ["class", "id", "style", "title"];
	const tagSpecific: Record<string, string[]> = {
		img: ["src", "alt", "width", "height", "loading", "decoding", "fetchpriority", "srcset", "sizes", "crossorigin", "referrerpolicy", "usemap", "ismap"],
		audio: ["src", "controls", "controlslist", "loop", "muted", "preload", "crossorigin", "referrerpolicy"],
		video: ["src", "controls", "controlslist", "loop", "muted", "preload", "width", "height", "poster", "crossorigin", "referrerpolicy"],
		input: ["type", "name", "value", "placeholder", "required", "disabled", "readonly", "autocomplete", "autofocus", "min", "max", "step", "minlength", "maxlength", "pattern", "list", "form", "inputmode"],
		a: ["href", "target", "rel", "hreflang", "type", "download", "ping", "referrerpolicy"],
		button: ["type", "disabled", "autofocus", "form", "formaction", "formenctype", "formmethod", "formnovalidate", "formtarget"],
		select: ["name", "required", "disabled", "autofocus", "multiple", "size", "form"],
		textarea: ["name", "placeholder", "required", "disabled", "readonly", "autofocus", "rows", "cols", "wrap", "minlength", "maxlength", "form"],
		form: ["action", "method", "enctype", "novalidate", "target", "autocomplete", "name"],
		script: ["src", "type", "async", "defer", "integrity", "nonce", "crossorigin", "referrerpolicy"],
		link: ["href", "rel", "as", "type", "sizes", "hreflang", "media", "crossorigin", "referrerpolicy", "integrity", "nonce", "color", "disabled"],
		iframe: ["src", "srcdoc", "name", "sandbox", "allow", "allowfullscreen", "loading", "referrerpolicy", "width", "height"],
	};
	return [...baseAttrs, ...(tagSpecific[tag] || [])];
}

function isInsideTag(context: CompletionContext): { tag: string; inTag: boolean; inAttribute: boolean } {
	const { state, pos } = context;
	const doc = state.doc;
	const line = doc.lineAt(pos);
	const lineText = line.text;
	const lineFrom = line.from;
	const cursorOffset = pos - lineFrom;

	const beforeCursor = lineText.slice(0, cursorOffset);

	const tagMatch = beforeCursor.match(/<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*$/);
	if (!tagMatch) {
		return { tag: "", inTag: false, inAttribute: false };
	}

	const tag = tagMatch[1].toLowerCase();
	const afterTag = beforeCursor.slice(tagMatch[0].indexOf("<") + 1);

	const inAttribute = /\s([a-zA-Z][a-zA-Z-]*)\s*$/.test(afterTag) ||
		/\s([a-zA-Z][a-zA-Z-]*)\s*=\s*"[^"]*$/.test(afterTag) ||
		/\s([a-zA-Z][a-zA-Z-]*)\s*=\s*'[^']*$/.test(afterTag) ||
		/\s([a-zA-Z][a-zA-Z-]*)\s*=\s*$/.test(afterTag);

	return { tag, inTag: true, inAttribute };
}

export const htmlCompletionSource: CompletionSource = (context: CompletionContext): CompletionList | null => {
	const { state, pos } = context;
	const doc = state.doc;
	const line = doc.lineAt(pos);
	const lineText = line.text;
	const lineFrom = line.from;
	const cursorOffset = pos - lineFrom;
	const beforeCursor = lineText.slice(0, cursorOffset);

	const tagContext = isInsideTag(context);

	if (tagContext.inTag) {
		if (tagContext.inAttribute) {
			return null;
		}

		const tag = tagContext.tag;
		const attrs = getTagAttributes(tag);
		const alreadyUsed = new Set(
			(beforeCursor.match(/([a-zA-Z][a-zA-Z-]*)\s*=/g) || [])
				.map((m) => m.replace(/\s*=$/, "")),
		);

		const completions = attrs
			.filter((attr) => !alreadyUsed.has(attr))
			.map((attr) => ({
				label: attr,
				kind: 14,
				detail: "attribute",
				apply: attr + '=""',
				boost: attr === "src" || attr === "href" || attr === "alt" ? 10 : 0,
			}));

		return new CompletionList(completions, false);
	}

	const tagMatch = beforeCursor.match(/<([a-zA-Z]*)$/);
	if (tagMatch) {
		const prefix = tagMatch[1].toLowerCase();
		const completions = HTML_TAGS
			.filter((tag) => tag.startsWith(prefix))
			.map((tag) => ({
				label: tag,
				kind: 14,
				detail: VOID_TAGS.has(tag) ? "void element" : "element",
				apply: VOID_TAGS.has(tag) ? `<${tag}>` : `<${tag}>`,
				info: VOID_TAGS.has(tag) ? "Void element (self-closing)" : "HTML element",
			}));

		return new CompletionList(completions, false);
	}

	return null;
};

export default function htmlCompletions(): Extension {
	return EditorState.languageData.of(() => [
		{ autocomplete: htmlCompletionSource },
	]);
}
