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

class CompletionWidget extends WidgetType {
	constructor(readonly text: string) {
		super();
	}

	eq(other: CompletionWidget): boolean {
		return this.text === other.text;
	}

	toDOM(): HTMLElement {
		const ghost = document.createElement("span");
		ghost.className = "cm-ai-completion-text";
		ghost.textContent = this.text;
		return ghost;
	}

	ignoreEvent(): boolean {
		return false;
	}
}

function suggestionDecoration(suggestion: Suggestion | null): DecorationSet {
	if (!suggestion?.text) return Decoration.none;
	return Decoration.set([
		Decoration.widget({
			widget: new CompletionWidget(suggestion.text),
			side: 1,
		}).range(suggestion.from),
	]);
}

const LOCAL_POLL_MS = 30;
const AI_POLL_MS = 120;

const styles = EditorView.baseTheme({
	".cm-ai-completion-text": {
		color: "rgba(128, 128, 128, 0.72)",
		whiteSpace: "pre-wrap",
		pointerEvents: "none",
	},
});

export default function aiInlineCompletion(
	config: AiInlineCompletionConfig,
): Extension {
	class AiCompletionPlugin {
		decorations: DecorationSet = Decoration.none;
		suggestion: Suggestion | null = null;
		localTimer: ReturnType<typeof setTimeout> | null = null;
		aiTimer: ReturnType<typeof setTimeout> | null = null;
		request: CancellableRequest | null = null;
		generation = 0;

		constructor(readonly view: EditorView) {}

		update(update: ViewUpdate): void {
			for (const tr of update.transactions) {
				for (const effect of tr.effects) {
					if (effect.is(setSuggestion)) {
						this.show(effect.value);
					}
				}
			}

			if (update.focusChanged && !update.view.hasFocus) {
				this.cancelAndClear();
				return;
			}

			const hasDocChange = update.docChanged;
			const hasSelChange = update.selectionSet;

			if (!hasDocChange && !hasSelChange) return;

			if (hasSelChange && !hasDocChange && this.suggestion !== null) {
				this.dismissSilent();
				return;
			}

			if (hasDocChange) {
				const sel = this.view.state.selection.main;
				const sug = this.suggestion;

				if (sug !== null) {
					if (!sel.empty || sel.head !== sug.from) {
						this.dismissSilent();
						this.schedule();
						return;
					}

					if (sel.head > sug.from + sug.text.length) {
						this.dismissSilent();
						this.schedule();
						return;
					}

					const typedLen = sel.head - sug.from;
					if (typedLen > 0 && typedLen <= sug.text.length) {
						const typed = this.view.state.doc.sliceString(sug.from, sel.head);
						if (sug.text.startsWith(typed)) {
							const remaining = sug.text.slice(typedLen);
							if (remaining.length > 0) {
								this.show({ from: sel.head, text: remaining });
							} else {
								this.show(null);
							}
							return;
						}
					}

					this.dismissSilent();
				}

				this.schedule();
			}
		}

		schedule(): void {
			const sel = this.view.state.selection.main;
			if (!sel.empty) return;
			const settings = config.getSettings();
			const meta = config.getFileContext?.(this.view) || {};
			const localEnabled = settings.localEnabled !== false;

			if (localEnabled) {
				if (this.localTimer) clearTimeout(this.localTimer);
				if (settings?.enabled) {
					this.localTimer = setTimeout(() => {
						this.localTimer = null;
						this.show(
							getLocalInlineCompletion({
								document: this.view.state.doc.toString(),
								position: sel.head,
								language: meta.language,
							}),
						);
					}, LOCAL_POLL_MS);
				} else {
					this.show(
						getLocalInlineCompletion({
							document: this.view.state.doc.toString(),
							position: sel.head,
							language: meta.language,
						}),
					);
				}
			}

			if (!settings?.enabled) return;
			if (this.aiTimer) clearTimeout(this.aiTimer);
			this.aiTimer = setTimeout(() => {
				this.aiTimer = null;
				void this.fetch();
			}, AI_POLL_MS);
		}

		async fetch(instruction?: string): Promise<void> {
			const settings = config.getSettings();
			const sel = this.view.state.selection.main;
			if (!settings?.enabled || !sel.empty) return;

			const from = sel.head;
			const doc = this.view.state.doc;
			const snapshotLen = doc.length;
			const meta = config.getFileContext?.(this.view) || {};
			const gen = ++this.generation;
			this.request?.cancel();
			this.request = requestInlineCompletion(
				{
					prefix: doc.sliceString(Math.max(0, from - 12_000), from),
					suffix: doc.sliceString(from, Math.min(doc.length, from + 4_000)),
					filename: meta.filename || "untitled",
					language: meta.language || "text",
					instruction: instruction,
				},
				settings,
			) as CancellableRequest;

			try {
				let text = String(await this.request.promise || "");
				if (gen !== this.generation) return;
				const current = this.view.state;
				if (
					current.doc.length !== snapshotLen ||
					current.selection.main.head !== from ||
					!current.selection.main.empty
				) return;

				const suffix = current.doc.sliceString(from, Math.min(current.doc.length, from + text.length));
				if (suffix && text.startsWith(suffix)) text = text.slice(suffix.length);
				if (!text) return;
				this.view.dispatch({ effects: setSuggestion.of({ from, text }) });
			} catch (error) {
				if (gen === this.generation) {
					console.warn("AI completion request failed", error);
				}
			} finally {
				if (gen === this.generation) this.request = null;
			}
		}

		show(suggestion: Suggestion | null): void {
			if (suggestion && (!suggestion.text || suggestion.text.length < 1)) {
				this.show(null);
				return;
			}
			this.suggestion = suggestion;
			this.decorations = suggestionDecoration(suggestion);
		}

		accept(): boolean {
			return this.insert(this.suggestion?.text || "", "");
		}

		insert(chunk: string, remaining: string): boolean {
			const sug = this.suggestion;
			if (!sug || !chunk) return false;
			const sel = this.view.state.selection.main;
			if (!sel.empty || sel.head !== sug.from) {
				this.dismiss();
				return false;
			}
			const nextFrom = sug.from + chunk.length;
			this.view.dispatch({
				changes: { from: sug.from, insert: chunk },
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
			this.clearTimers();
			this.request?.cancel();
			this.request = null;
			this.view.dispatch({ effects: setSuggestion.of(null) });
			return true;
		}

		dismissSilent(): void {
			this.generation++;
			this.clearTimers();
			this.request?.cancel();
			this.request = null;
			this.show(null);
		}

		clearTimers(): void {
			if (this.localTimer) clearTimeout(this.localTimer);
			this.localTimer = null;
			if (this.aiTimer) clearTimeout(this.aiTimer);
			this.aiTimer = null;
		}

		cancelAndClear(): void {
			this.generation++;
			this.clearTimers();
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
				run: (view) => view.plugin(pluginExtension)?.accept() ?? false,
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