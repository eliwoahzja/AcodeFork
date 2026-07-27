import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

export const config = {
	name: "cobalt2",
	dark: true,
	background: "#193549",
	foreground: "#ffffff",
	selection: "#1f4662",
	cursor: "#ffc600",
	dropdownBackground: "#152c3d",
	dropdownBorder: "#0d3a58",
	activeLine: "#1f46624a",
	lineNumber: "#ffffff50",
	lineNumberActive: "#ffc600",
	matchingBracket: "#0d3a58",
	keyword: "#ff9d00",
	storage: "#ff9d00",
	variable: "#ffc600",
	parameter: "#ff9d00",
	function: "#ffc600",
	string: "#a5ff90",
	constant: "#ff628c",
	number: "#facc6b",
	comment: "#0088ffa0",
	heading: "#ffc600",
	invalid: "#ffc7c7",
	regexp: "#aed255",
	tag: "#9eeff0",
	type: "#9effff",
	class: "#ffc600",
};

export const cobalt2Theme = EditorView.theme(
	{
		"&": { color: config.foreground, backgroundColor: config.background },
		".cm-content": { caretColor: config.cursor },
		".cm-cursor, .cm-dropCursor": { borderLeftColor: config.cursor },
		"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
			{ backgroundColor: config.selection },
		".cm-panels": { backgroundColor: config.dropdownBackground, color: config.foreground },
		".cm-panels.cm-panels-top": { borderBottom: `1px solid ${config.dropdownBorder}` },
		".cm-panels.cm-panels-bottom": { borderTop: `1px solid ${config.dropdownBorder}` },
		".cm-searchMatch": { backgroundColor: config.dropdownBackground, outline: `1px solid ${config.dropdownBorder}` },
		".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: config.selection },
		".cm-activeLine": { backgroundColor: config.activeLine },
		".cm-selectionMatch": { backgroundColor: config.selection },
		"&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
			backgroundColor: config.matchingBracket,
			outline: "none",
		},
		".cm-gutters": { backgroundColor: config.background, color: config.foreground, border: "none" },
		".cm-activeLineGutter": { backgroundColor: config.background },
		".cm-lineNumbers .cm-gutterElement": { color: config.lineNumber },
		".cm-lineNumbers .cm-activeLineGutter": { color: config.lineNumberActive },
		".cm-foldPlaceholder": { backgroundColor: "transparent", border: "none", color: config.foreground },
		".cm-tooltip": { border: `1px solid ${config.dropdownBorder}`, background: config.dropdownBackground, color: config.foreground },
		".cm-tooltip .cm-tooltip-arrow:before": { borderTopColor: "transparent", borderBottomColor: "transparent" },
		".cm-tooltip .cm-tooltip-arrow:after": { borderTopColor: config.foreground, borderBottomColor: config.foreground },
		".cm-tooltip-autocomplete": {
			"& > ul > li[aria-selected]": { background: config.selection, color: config.foreground },
		},
	},
	{ dark: config.dark },
);

export const cobalt2HighlightStyle = HighlightStyle.define([
	{ tag: t.keyword, color: config.keyword },
	{ tag: [t.name, t.deleted, t.character, t.macroName], color: config.variable },
	{ tag: [t.propertyName], color: config.function },
	{ tag: [t.processingInstruction, t.string, t.inserted, t.special(t.string)], color: config.string },
	{ tag: [t.function(t.variableName), t.labelName], color: config.function },
	{ tag: [t.number, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: config.number },
	{ tag: [t.url, t.escape, t.regexp, t.link], color: config.string },
	{ tag: [t.meta, t.comment], color: config.comment },
	{ tag: [t.typeName], color: config.type },
	{ tag: [t.className], color: config.class },
	{ tag: t.tagName, color: config.tag },
	{ tag: t.strong, fontWeight: "bold" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.link, textDecoration: "underline" },
	{ tag: t.heading, fontWeight: "bold", color: config.heading },
	{ tag: [t.atom, t.bool, t.special(t.variableName)], color: config.variable },
	{ tag: t.invalid, color: config.invalid },
	{ tag: t.strikethrough, textDecoration: "line-through" },
]);

export function cobalt2() {
	return [cobalt2Theme, syntaxHighlighting(cobalt2HighlightStyle)];
}