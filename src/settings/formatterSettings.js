import { getModes } from "cm/modelist";
import settingsPage from "components/settingsPage";
import appSettings from "lib/settings";
import helpers from "utils/helpers";

export default function formatterSettings(languageName) {
	const title = strings.formatter;
	const values = appSettings.value;
	const { formatters } = acode;
	const languagesLabel = strings.languages || "Languages";

	const formatterOptions = formatters.map(({ id, name }) => [id, name]);
	formatterOptions.unshift([null, "None (pick per language)"]);

const items = getModes()
		.slice()
		.sort((a, b) =>
			String(a.caption || a.name).localeCompare(String(b.caption || b.name)),
		)
		.map((mode) => {
			const { name, caption, extensions } = mode;
			const formatterID = values.formatter[name] || null;
			const extList = String(extensions)
				.split("|")
				.filter((e) => e && !e.startsWith("^"));
			const options = acode.getFormatterFor(extList);
			const sampleExt = extList[0] || name;

			return {
				key: name,
				text: caption,
				icon: helpers.getIconForFile(`sample.${sampleExt}`),
				value: formatterID,
				valueText: (value) => {
					const fmt = formatters.find(({ id }) => id === value);
					return fmt ? fmt.name : strings.none;
				},
				select: options,
				chevron: true,
				category: languagesLabel,
			};
		});

	items.unshift({
		key: "__default__",
		text: "Default for all languages",
		value: values.formatter.__default__ || null,
		valueText: (value) => {
			const fmt = formatters.find(({ id }) => id === value);
			return fmt ? fmt.name : "Per language";
		},
		select: formatterOptions,
		chevron: true,
		category: "General",
		info: "Applies to every language unless explicitly overridden below.",
	});

	items.unshift({
		note: strings["settings-note-formatter-settings"],
	});

	const page = settingsPage(title, items, callback, "separate", {
		preserveOrder: true,
		pageClassName: "detail-settings-page formatter-settings-page",
		listClassName: "detail-settings-list formatter-settings-list",
		notePosition: "top",
	});
	page.show(languageName);

	function callback(key, value) {
		if (value === null) {
			// Delete the key when "none" is selected
			delete values.formatter[key];
		} else {
			values.formatter[key] = value;
		}
		appSettings.update();
	}
}
