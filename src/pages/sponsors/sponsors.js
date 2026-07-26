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
		<div id="sponsors-page" style={{ padding: "20px", overflowY: "auto", height: "100%", width: "100%", boxSizing: "border-box", background: "var(--bg-color)" }}>
			<div style={{ maxWidth: "600px", margin: "0 auto", background: "var(--secondary-color)", borderRadius: "12px", overflow: "hidden", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
				
				{/* Header Banner */}
				<div style={{ height: "120px", background: "linear-gradient(135deg, var(--active-color) 0%, var(--primary-color) 100%)" }}></div>
				
				{/* Profile Info */}
				<div style={{ padding: "0 20px 20px 20px", position: "relative", marginTop: "-50px", textAlign: "center" }}>
					<img 
						src="https://github.com/eliwoahzja.png" 
						alt="eliwoahzja" 
						style={{ width: "100px", height: "100px", borderRadius: "50%", border: "4px solid var(--secondary-color)", background: "#fff", objectFit: "cover" }}
					/>
					<h2 style={{ margin: "10px 0 5px 0", color: "var(--primary-text-color)", fontSize: "1.5rem" }}>eliwoahzja</h2>
					<p style={{ color: "var(--secondary-text-color)", margin: "0 0 15px 0", fontSize: "0.9rem" }}>@eliwoahzja</p>
					
					<p style={{ color: "var(--primary-text-color)", lineHeight: "1.5", margin: "0 0 20px 0" }}>
						Passionate developer building cool things. Creator of Acode AI Autocomplete and Eli Complete.
					</p>
					
					<button 
						style={{ padding: "10px 24px", background: "var(--active-color)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "1rem", fontWeight: "600" }}
						onclick={() => system.openInBrowser("https://github.com/eliwoahzja")}
					>
						<span className="icon github"></span> Follow on GitHub
					</button>
				</div>
				
				{/* Projects Section */}
				<div style={{ borderTop: "1px solid var(--border-color)", padding: "20px" }}>
					<h3 style={{ margin: "0 0 15px 0", color: "var(--primary-text-color)" }}>Projects</h3>
					
					<div style={{ padding: "15px", border: "1px solid var(--border-color)", borderRadius: "8px", marginBottom: "10px", background: "var(--primary-color)" }}>
						<h4 style={{ margin: "0 0 5px 0", color: "var(--active-color)" }}>Acode AI Autocomplete</h4>
						<p style={{ margin: "0", color: "var(--secondary-text-color)", fontSize: "0.9rem" }}>Acode fork with powerful, context-aware AI completions built in.</p>
					</div>
					
					<div style={{ padding: "15px", border: "1px solid var(--border-color)", borderRadius: "8px", background: "var(--primary-color)" }}>
						<h4 style={{ margin: "0 0 5px 0", color: "var(--active-color)" }}>Eli Complete</h4>
						<p style={{ margin: "0", color: "var(--secondary-text-color)", fontSize: "0.9rem" }}>Free, privacy-first AI code completions extension for VS Code.</p>
					</div>
				</div>
			</div>
		</div>
	);

	app.append(page);
}
