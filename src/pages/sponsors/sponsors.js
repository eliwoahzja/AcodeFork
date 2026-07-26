import "./style.scss";
import Page from "components/page";
import actionStack from "lib/actionStack";

export default function Sponsors() {
	const page = Page("Developer Profile");
	
	actionStack.push({
		id: "developer_profile_page",
		action: page.hide,
	});

	page.onhide = () => {
		actionStack.remove("developer_profile_page");
	};

	page.body = (
		<div id="sponsors-page" style={{ padding: "16px", overflowY: "auto", height: "100%", width: "100%", boxSizing: "border-box" }}>
			<div className="cta-section" style={{ textAlign: "center", marginBottom: "20px" }}>
				<p className="cta-text" style={{ fontSize: "1.2rem", fontWeight: "bold" }}>Built by eliwoahzja</p>
				<button 
					className="cta-button" 
					style={{ padding: "8px 16px", background: "var(--active-color)", color: "var(--active-text-color)", border: "none", borderRadius: "8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}
					onclick={() => system.openInBrowser("https://github.com/eliwoahzja")}
				>
					View on GitHub <span className="icon github"></span>
				</button>
			</div>
			<div 
				className="sponsors-container" 
				id="github-readme"
				style={{ 
					background: "var(--secondary-color)", 
					color: "var(--secondary-text-color)",
					padding: "16px", 
					borderRadius: "8px",
					lineHeight: "1.6",
					wordWrap: "break-word"
				}}
			>
				<div style={{ textAlign: "center", padding: "40px" }}>Loading profile...</div>
			</div>
		</div>
	);

	app.append(page);

	fetch("https://api.github.com/repos/eliwoahzja/eliwoahzja/readme", {
		headers: { "Accept": "application/vnd.github.v3.html" }
	})
	.then(res => {
		if (!res.ok) throw new Error("Failed to fetch");
		return res.text();
	})
	.then(html => {
		const container = page.body.querySelector("#github-readme");
		if (container) {
			container.innerHTML = html;
			// Style images so they fit
			container.querySelectorAll("img").forEach(img => {
				img.style.maxWidth = "100%";
				img.style.height = "auto";
			});
		}
	})
	.catch(err => {
		const container = page.body.querySelector("#github-readme");
		if (container) container.innerHTML = "<div style='text-align: center; color: var(--error-text-color)'>Failed to load GitHub profile.</div>";
	});
}
