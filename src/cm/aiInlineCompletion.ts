import { Prec, StateEffect, type Extension } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	EditorView,
	keymap,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import { requestInlineCompletion } from "lib/ai/completionService";
import { getLocalInlineCompletion } from "cm/localInlineCompletions";
import prompt from "dialogs/prompt";

interface AiCompletionSettings {
	enabled?: boolean;
	localEnabled?: boolean;
	mode?: "managed" | "byok";
	provider?: string;
	endpoint?: string;
	model?: string;
	managedEndpoint?: string;
	maxTokens?: number;
	debounceMs?: number;
}

interface FileContext {
	filename?: string;
	language?: string;
}

interface Suggestion {
	from: number;
	text: string;
}

interface CancellableRequest {
	promise: Promise<string>;
	cancel(): void;
}

export interface AiInlineCompletionConfig {
	getSettings(): AiCompletionSettings;
	getFileContext?(view: EditorView): FileContext;
}

const setSuggestion = StateEffect.define<Suggestion | null>();

function nextCompletionChunk(text: string): string {
	const match = text.match(
		/^\s*(?:[\p{L}\p{N}_$]+|[^\s\p{L}\p{N}_$])(?:[ \t]+)?/u,
	);
	return match?.[0] || Array.from(text)[0] || "";
}

class CompletionWidget extends WidgetType {
	constructor(
		readonly text: string,
		readonly action: (name: "accept" | "next" | "dismiss") => void,
	) {
		super();
	}

	eq(other: CompletionWidget): boolean {
		return this.text === other.text;
	}

	toDOM(): HTMLElement {
		const root = document.createElement("span");
		root.className = "cm-ai-completion";

		const ghost = document.createElement("span");
		ghost.className = "cm-ai-completion-text";
		ghost.textContent = this.text;
		root.append(ghost);

		const controls = document.createElement("span");
		controls.className = "cm-ai-completion-controls";
		for (const [name, label] of [
			["accept", "Accept"],
			["next", "Next word"],
			["dismiss", "Dismiss"],
		] as const) {
			const button = document.createElement("button");
			button.type = "button";
			button.className = `cm-ai-completion-${name}`;
			button.textContent = label;
			button.addEventListener("pointerdown", (event) => event.preventDefault());
			button.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.action(name);
			});
			controls.append(button);
		}
		root.append(controls);
		return root;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function suggestionDecoration(
	suggestion: Suggestion | null,
	action: (name: "accept" | "next" | "dismiss") => void,
): DecorationSet {
	if (!suggestion?.text) return Decoration.none;
	return Decoration.set([
		Decoration.widget({
			widget: new CompletionWidget(suggestion.text, action),
			side: 1,
		}).range(suggestion.from),
	]);
}

const styles = EditorView.baseTheme({
	".cm-ai-completion": {
		position: "relative",
		display: "inline",
	},
	".cm-ai-completion-text": {
		color: "rgba(128, 128, 128, 0.72)",
		whiteSpace: "pre-wrap",
		pointerEvents: "none",
	},
	".cm-ai-completion-controls": {
		position: "absolute",
		zIndex: "20",
		left: "0",
		top: "calc(100% + 6px)",
		display: "flex",
		gap: "4px",
		padding: "4px",
		borderRadius: "8px",
		background: "var(--secondary-color, #252525)",
		boxShadow: "0 3px 12px rgba(0, 0, 0, .3)",
		whiteSpace: "nowrap",
	},
	".cm-ai-completion-controls button": {
		minHeight: "32px",
		padding: "4px 9px",
		border: "0",
		borderRadius: "6px",
		color: "var(--popup-text-color, currentColor)",
		background: "rgba(127, 127, 127, .18)",
		font: "inherit",
		fontSize: "12px",
		touchAction: "manipulation",
	},
	".cm-ai-completion-accept": {
		background: "var(--primary-color, #4b8bf4) !important",
		color: "white !important",
	},
});

export default function aiInlineCompletion(
	config: AiInlineCompletionConfig,
): Extension {
	class AiCompletionPlugin {
			decorations: DecorationSet = Decoration.none;
			suggestion: Suggestion | null = null;
			timer: ReturnType<typeof setTimeout> | null = null;
			request: CancellableRequest | null = null;
			generation = 0;

			constructor(readonly view: EditorView) {}

			update(update: ViewUpdate): void {
				let effectSeen = false;
				let effectValue = null;
				for (const transaction of update.transactions) {
					for (const effect of transaction.effects) {
						if (!effect.is(setSuggestion)) continue;
						effectSeen = true;
						effectValue = effect.value;
						this.show(effect.value);
					}
				}

				if (update.focusChanged && !update.view.hasFocus) {
					this.cancelAndClear();
					return;
				}

				if (effectSeen) {
					if (!effectValue && update.docChanged) {
						this.schedule();
					}
					return;
				}

				if (update.docChanged || update.selectionSet) {
					this.cancelAndClear();
					if (update.docChanged) this.schedule();
				}
			}

			schedule(): void {
				const settings = config.getSettings();
				if (!this.view.state.selection.main.empty) return;
				const selection = this.view.state.selection.main;
				const metadata = config.getFileContext?.(this.view) || {};
				if (settings.localEnabled !== false) {
					this.show(
						getLocalInlineCompletion({
							document: this.view.state.doc.toString(),
							position: selection.head,
							language: metadata.language,
						}),
					);
				}
				if (!settings?.enabled) return;
				if (this.timer) clearTimeout(this.timer);
				const delay = Math.max(150, Math.min(Number(settings.debounceMs) || 650, 5000));
				this.timer = setTimeout(() => {
					this.timer = null;
					void this.fetch();
				}, delay);
			}

			async fetch(instruction?: string): Promise<void> {
				const settings = config.getSettings();
				const selection = this.view.state.selection.main;
				if (!settings?.enabled || !selection.empty) return;

				const from = selection.head;
				const doc = this.view.state.doc;
				const snapshotLength = doc.length;
				const metadata = config.getFileContext?.(this.view) || {};
				const generation = ++this.generation;
				this.request?.cancel();
				this.request = requestInlineCompletion(
					{
						prefix: doc.sliceString(Math.max(0, from - 12_000), from),
						suffix: doc.sliceString(from, Math.min(doc.length, from + 4_000)),
						filename: metadata.filename || "untitled",
						language: metadata.language || "text",
						instruction: instruction,
					},
					settings,
				) as CancellableRequest;

				try {
					let text = String(await this.request.promise || "");
					if (generation !== this.generation) return;
					const current = this.view.state;
					if (
						current.doc.length !== snapshotLength ||
						current.selection.main.head !== from ||
						!current.selection.main.empty
					) return;

					const suffix = current.doc.sliceString(from, Math.min(current.doc.length, from + text.length));
					if (suffix && text.startsWith(suffix)) text = text.slice(suffix.length);
					if (!text) return;
					this.view.dispatch({ effects: setSuggestion.of({ from, text }) });
				} catch (error) {
					if (generation === this.generation) {
						console.warn("AI inline completion request failed", error);
					}
				} finally {
					if (generation === this.generation) this.request = null;
				}
			}

			show(suggestion: Suggestion | null): void {
				this.suggestion = suggestion;
				this.decorations = suggestionDecoration(suggestion, (name) => {
					if (name === "accept") this.acceptAll();
					else if (name === "next") this.acceptNext();
					else this.dismiss();
				});
			}

			acceptAll(): boolean {
				return this.insert(this.suggestion?.text || "", "");
			}

			acceptNext(): boolean {
				if (!this.suggestion) return false;
				const chunk = nextCompletionChunk(this.suggestion.text);
				return this.insert(chunk, this.suggestion.text.slice(chunk.length));
			}

			insert(chunk: string, remaining: string): boolean {
				const suggestion = this.suggestion;
				if (!suggestion || !chunk) return false;
				const selection = this.view.state.selection.main;
				if (!selection.empty || selection.head !== suggestion.from) {
					this.dismiss();
					return false;
				}
				const nextFrom = suggestion.from + chunk.length;
				this.view.dispatch({
					changes: { from: suggestion.from, insert: chunk },
					selection: { anchor: nextFrom },
					effects: setSuggestion.of(
						remaining ? { from: nextFrom, text: remaining } : null,
					),
					userEvent: "input.complete.ai",
				});
				return true;
			}

			dismiss(): boolean {
				if (!this.suggestion) return false;
				this.generation++;
				if (this.timer) clearTimeout(this.timer);
				this.timer = null;
				this.request?.cancel();
				this.request = null;
				this.view.dispatch({ effects: setSuggestion.of(null) });
				return true;
			}

			cancelAndClear(): void {
				this.generation++;
				if (this.timer) clearTimeout(this.timer);
				this.timer = null;
				this.request?.cancel();
				this.request = null;
				this.show(null);
			}

			destroy(): void {
				this.cancelAndClear();
			}
	}

	const pluginExtension = ViewPlugin.fromClass(AiCompletionPlugin, {
		decorations: (value) => value.decorations,
	});

	const commands = Prec.high(
		keymap.of([
			{
				key: "Tab",
				run: (view) => view.plugin(pluginExtension)?.acceptAll() ?? false,
			},
			{
				key: "Escape",
				run: (view) => view.plugin(pluginExtension)?.dismiss() ?? false,
			},
			{
				key: "Alt-\\",
				run: (view) => {
					view.plugin(pluginExtension)?.fetch();
					return true;
				},
			},
			{
				key: "Alt-a",
				run: (view) => {
					prompt("AI Context", "", "text", {
						placeholder: "e.g. generate a fetch function",
						required: true,
					}).then((instruction) => {
						if (instruction) {
							view.plugin(pluginExtension)?.fetch(String(instruction));
						}
					});
					return true;
				},
			},
		]),
	);

	return [pluginExtension, commands, styles];
}
