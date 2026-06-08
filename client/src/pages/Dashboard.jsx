import { useState } from "react";
import { runPipeline, sendApproved } from "../services/pipelineService";

const STAGES = [
  { id: 1, label: "Ocean.io", sub: "Find lookalike companies", icon: "◎" },
  { id: 2, label: "Prospeo", sub: "Enrich decision-makers", icon: "◈" },
  { id: 3, label: "Checkpoint", sub: "Review & approve", icon: "◉" },
  { id: 4, label: "Brevo", sub: "Send personalized emails", icon: "◍" },
];

const C = {
  bg: "#070b14", surface: "#0d1424", border: "#1e2d45",
  accent: "#4f8aff", accentDim: "#1d3461",
  green: "#22d3a5", greenDim: "#0d3328",
  yellow: "#f59e0b", yellowDim: "#2d2108",
  red: "#f87171", redDim: "#2d1515",
  text: "#e2e8f0", muted: "#64748b", dim: "#94a3b8",
};

const mono = "'JetBrains Mono', monospace";
const sans = "'DM Sans', system-ui, sans-serif";

const Tag = ({ children, color = C.accent, bg = C.accentDim }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 7px", borderRadius: 4, fontSize: 10, fontFamily: mono, fontWeight: 600, color, background: bg }}>
    {children}
  </span>
);

const StageRow = ({ stage, status, message, count }) => {
  const isActive = status === "running";
  const isDone = status === "done" || status === "success";
  const isWarn = status === "empty";
  const color = isActive ? C.accent : isDone ? C.green : isWarn ? C.yellow : C.muted;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 16px", borderLeft: `3px solid ${color}`, background: isActive ? `${C.accent}08` : "transparent", transition: "all 0.3s" }}>
      <span style={{ fontSize: 16, color, marginTop: 1 }}>{stage.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.text }}>{stage.label}</span>
          {isActive && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, display: "inline-block", animation: "pulse 1.2s infinite" }} />}
          {isDone && count > 0 && <Tag color={C.green} bg={C.greenDim}>{count} found</Tag>}
          {isWarn && <Tag color={C.yellow} bg={C.yellowDim}>empty</Tag>}
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>{stage.sub}</div>
        {message && <div style={{ fontFamily: mono, fontSize: 10, color: isWarn ? C.yellow : C.dim, marginTop: 3 }}>→ {message}</div>}
      </div>
    </div>
  );
};

const CompanyCard = ({ c }) => (
  <div style={{ padding: "10px 14px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <div style={{ width: 26, height: 26, borderRadius: 5, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.accent, fontFamily: mono }}>
        {c.name?.[0]?.toUpperCase() || "?"}
      </div>
      <div>
        <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.text }}>{c.name}</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>{c.domain}</div>
      </div>
    </div>
    {c.industry && <Tag>{c.industry}</Tag>}
  </div>
);

const ContactRow = ({ contact, selected, onToggle }) => (
  <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer", background: selected ? `${C.accent}0a` : C.surface, border: `1px solid ${selected ? C.accent : C.border}`, borderRadius: 8, transition: "all 0.15s" }}>
    <div style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${selected ? C.accent : C.border}`, background: selected ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {selected && <span style={{ color: "#fff", fontSize: 9, fontWeight: 700 }}>✓</span>}
    </div>
    <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
      {(contact.fullName || contact.name || "?")[0].toUpperCase()}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 600, color: C.text }}>{contact.fullName || contact.name}</div>
      <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {contact.title} · {contact.companyName || contact.companyDomain}
      </div>
    </div>
    <div style={{ textAlign: "right", flexShrink: 0 }}>
      <div style={{ fontFamily: mono, fontSize: 10, color: contact.emailVerified ? C.green : C.dim }}>{contact.email}</div>
      {contact.emailVerified && <Tag color={C.green} bg={C.greenDim}>verified</Tag>}
    </div>
  </div>
);

export default function Dashboard() {
  const [domain, setDomain] = useState("");
  const [phase, setPhase] = useState("idle");
  const [stageInfo, setStageInfo] = useState({});
  const [companies, setCompanies] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [usingFallback, setUsingFallback] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [sendResult, setSendResult] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");

  const addLog = (msg, level = "info") =>
    setLog(l => [...l.slice(-100), { msg, level, t: Date.now() }]);

  const setStage = (id, patch) =>
    setStageInfo(s => ({ ...s, [id]: { ...s[id], ...patch } }));

  const handleRun = async () => {
    if (!domain.trim() || phase === "running") return;
    setPhase("running");
    setError("");
    setStageInfo({});
    setCompanies([]);
    setContacts([]);
    setUsingFallback(false);
    setSendResult(null);
    setLog([]);
    addLog(`Starting pipeline for: ${domain}`);

    try {
      setStage(1, { status: "running", message: `Finding lookalikes for ${domain}...` });
      addLog(`[Stage 1] Ocean.io — finding lookalike companies`);

      const result = await runPipeline(domain.trim());

      const co = result.companies || [];
      const ct = result.contacts || [];
      const fallback = result.usingFallback || false;

      setStage(1, { status: co.length ? "done" : "empty", message: `${co.length} companies found`, count: co.length });
      addLog(`[Stage 1] ${co.length} companies found`, co.length ? "success" : "warn");
      setCompanies(co);

      setStage(2, { status: ct.length ? "done" : "empty", message: `${ct.length} contacts found`, count: ct.length });
      addLog(`[Stage 2] ${ct.length} contacts enriched${fallback ? " (demo fallback)" : ""}`, ct.length ? "success" : "warn");
      setContacts(ct);
      setUsingFallback(fallback);

      setSelected(new Set(ct.map((_, i) => i)));
      setStage(3, { status: "done", message: `${ct.length} contacts ready for review`, count: ct.length });
      addLog(`Checkpoint — review contacts before sending`, "warn");

      setPhase("checkpoint");
    } catch (err) {
      setError(err.message);
      setPhase("error");
      addLog(`Error: ${err.message}`, "error");
    }
  };

  const handleSend = async () => {
    const approved = contacts.filter((_, i) => selected.has(i));
    if (!approved.length) return;
    setPhase("sending");
    setStage(4, { status: "running", message: `Sending to ${approved.length} contacts...` });
    addLog(`Sending emails to ${approved.length} approved contacts`);

    try {
      const result = await sendApproved(approved);
      setSendResult(result);
      setStage(4, { status: "done", message: `${result.sent} sent, ${result.failed} failed`, count: result.sent });
      addLog(`Brevo: ${result.sent} sent, ${result.failed} failed`, "success");
      setPhase("done");
    } catch (err) {
      setError(err.message);
      setStage(4, { status: "empty", message: err.message });
      addLog(`Brevo error: ${err.message}`, "error");
      setPhase("error");
    }
  };

  const toggleContact = (i) =>
    setSelected(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const toggleAll = () =>
    setSelected(selected.size === contacts.length ? new Set() : new Set(contacts.map((_, i) => i)));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: sans }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.35} }
        @keyframes fi { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
        .fi { animation: fi 0.25s ease forwards; }
        input::placeholder { color: #64748b; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 2px; }
      `}</style>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${C.border}`, padding: "14px 28px", display: "flex", alignItems: "center", gap: 14, background: `${C.surface}dd`, backdropFilter: "blur(10px)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ width: 30, height: 30, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>⬡</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>VocalLabs Outreach Pipeline</div>
          <div style={{ fontFamily: mono, fontSize: 9, color: C.muted }}>Ocean → Prospeo → Brevo</div>
        </div>
        {phase !== "idle" && (
          <div style={{ marginLeft: "auto" }}>
            <Tag
              color={phase === "done" ? C.green : phase === "error" ? C.red : phase === "checkpoint" ? C.yellow : C.accent}
              bg={phase === "done" ? C.greenDim : phase === "error" ? C.redDim : phase === "checkpoint" ? C.yellowDim : C.accentDim}
            >
              {phase.toUpperCase()}
            </Tag>
          </div>
        )}
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Hero */}
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.accent, letterSpacing: "0.12em", marginBottom: 10 }}>AUTOMATED COLD OUTREACH</div>
          <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 6 }}>
            One domain.<br /><span style={{ color: C.accent }}>Full pipeline.</span>
          </h1>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 28, maxWidth: 460 }}>
            Input a seed domain → discover lookalike companies → find decision-makers → send personalized outreach.
          </p>
          <div style={{ display: "flex", gap: 10, maxWidth: 560 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: mono, fontSize: 12, color: C.muted, pointerEvents: "none" }}>~$</span>
              <input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRun()}
                placeholder="stripe.com"
                disabled={phase === "running" || phase === "sending"}
                style={{ width: "100%", padding: "13px 14px 13px 38px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 13, fontFamily: mono, outline: "none" }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
              />
            </div>
            <button
              onClick={handleRun}
              disabled={!domain.trim() || phase === "running" || phase === "sending"}
              style={{ padding: "0 22px", borderRadius: 10, border: "none", background: (phase === "running" || phase === "sending") ? C.accentDim : C.accent, color: (phase === "running" || phase === "sending") ? C.accent : "#fff", fontFamily: sans, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {phase === "running" ? "Running..." : phase === "sending" ? "Sending..." : "Run Pipeline →"}
            </button>
          </div>
          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 8, fontFamily: mono, fontSize: 11, color: C.red }}>
              ✕ {error}
            </div>
          )}
        </div>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, alignItems: "start" }}>

          {/* Stages */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: C.surface }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>PIPELINE STAGES</div>
            {STAGES.map(s => (
              <StageRow key={s.id} stage={s}
                status={stageInfo[s.id]?.status || "idle"}
                message={stageInfo[s.id]?.message}
                count={stageInfo[s.id]?.count}
              />
            ))}
            {(companies.length > 0 || contacts.length > 0) && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                {[["Companies", companies.length, C.accent], ["Contacts", contacts.length, C.green]].map(([label, val, color]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>{label}</span>
                    <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color }}>{val}</span>
                  </div>
                ))}
                {sendResult && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>Emails Sent</span>
                    <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: C.green }}>{sendResult.sent}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Idle */}
            {phase === "idle" && (
              <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: "60px 20px", textAlign: "center", color: C.muted }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⬡</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Pipeline ready</div>
                <div style={{ fontFamily: mono, fontSize: 11, marginTop: 4 }}>Enter a domain above to begin</div>
              </div>
            )}

            {/* Running */}
            {phase === "running" && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "40px 20px", textAlign: "center" }}>
                <div style={{ fontFamily: mono, fontSize: 12, color: C.accent }}>Running Ocean.io + Prospeo...</div>
                <div style={{ fontFamily: mono, fontSize: 10, marginTop: 8, color: C.muted }}>This may take 30–90 seconds due to Prospeo rate limits</div>
              </div>
            )}

            {/* Companies */}
            {companies.length > 0 && (
              <div className="fi" style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: C.surface }}>
                <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, fontFamily: mono, fontSize: 10, color: C.muted, letterSpacing: "0.1em" }}>
                  LOOKALIKE COMPANIES <Tag>{companies.length}</Tag>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, padding: 14 }}>
                  {companies.map((c, i) => <CompanyCard key={i} c={c} />)}
                </div>
              </div>
            )}

            {/* Fallback notice */}
            {usingFallback && (
              <div className="fi" style={{ padding: "10px 16px", background: `${C.yellowDim}88`, border: `1px solid ${C.yellow}44`, borderRadius: 8, fontFamily: mono, fontSize: 11, color: C.yellow }}>
                ⚠ Prospeo returned 0 verified contacts (free plan limit). Demo contacts injected from Ocean companies so the full pipeline can be demonstrated.
              </div>
            )}

            {/* Checkpoint */}
            {phase === "checkpoint" && contacts.length > 0 && (
              <div className="fi" style={{ border: `1px solid ${C.yellow}44`, borderRadius: 12, overflow: "hidden", background: `${C.yellowDim}88` }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.yellow}33`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 10, color: C.yellow, letterSpacing: "0.1em", marginBottom: 2 }}>★ SAFETY CHECKPOINT</div>
                    <div style={{ fontSize: 12, color: C.dim }}>Review contacts before sending. Deselect any to skip.</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={toggleAll} style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.surface, color: C.dim, cursor: "pointer", fontSize: 11, fontFamily: mono }}>
                      {selected.size === contacts.length ? "Deselect All" : "Select All"}
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={selected.size === 0}
                      style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: selected.size > 0 ? C.green : C.border, color: selected.size > 0 ? C.bg : C.muted, cursor: selected.size > 0 ? "pointer" : "not-allowed", fontSize: 11, fontFamily: mono, fontWeight: 700 }}
                    >
                      Send to {selected.size} →
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, maxHeight: 420, overflowY: "auto" }}>
                  {contacts.map((c, i) => (
                    <ContactRow key={i} contact={c} selected={selected.has(i)} onToggle={() => toggleContact(i)} />
                  ))}
                </div>
              </div>
            )}

            {/* No contacts */}
            {phase === "checkpoint" && contacts.length === 0 && (
              <div className="fi" style={{ border: `1px solid ${C.yellow}44`, borderRadius: 12, padding: "24px 20px", background: `${C.yellowDim}66` }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.yellow, marginBottom: 6 }}>⚠ No contacts found</div>
                <div style={{ fontSize: 12, color: C.dim }}>Ocean found no lookalike companies for this domain. Try a different seed domain like stripe.com, notion.so, or linear.app.</div>
              </div>
            )}

            {/* Send results */}
            {sendResult && (
              <div className="fi" style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: C.surface }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: `1px solid ${C.border}` }}>
                  {[["Sent", sendResult.sent, C.green], ["Failed", sendResult.failed, sendResult.failed > 0 ? C.red : C.muted], ["Dry Run", sendResult.dryRun ? "YES" : "NO", sendResult.dryRun ? C.yellow : C.muted]].map(([label, val, color]) => (
                    <div key={label} style={{ padding: "14px 18px", borderRight: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: mono }}>{val}</div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: mono, fontSize: 10, color: C.muted, padding: "8px 14px", borderBottom: `1px solid ${C.border}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 60px", gap: 8 }}>
                  <span>NAME</span><span>EMAIL</span><span>COMPANY</span><span>STATUS</span>
                </div>
                {(sendResult.results || []).map((r, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 60px", gap: 8, padding: "8px 14px", borderBottom: `1px solid ${C.border}33`, fontFamily: mono, fontSize: 10, alignItems: "center" }}>
                    <span style={{ color: C.text, fontWeight: 600 }}>{r.contact?.fullName}</span>
                    <span style={{ color: C.muted, overflow: "hidden", textOverflow: "ellipsis" }}>{r.contact?.email}</span>
                    <span style={{ color: C.muted }}>{r.contact?.companyName}</span>
                    <Tag color={r.success ? C.green : C.red} bg={r.success ? C.greenDim : C.redDim}>{r.success ? "SENT" : "FAIL"}</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Log */}
        {log.length > 0 && (
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: "#050810" }}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: C.muted }}>PIPELINE LOG</span>
              {[C.red, C.yellow, C.green].map(c => <div key={c} style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />)}
            </div>
            <div style={{ padding: "10px 14px", maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
              {log.map((entry, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontFamily: mono, fontSize: 10 }}>
                  <span style={{ color: C.muted, flexShrink: 0 }}>{new Date(entry.t).toLocaleTimeString("en", { hour12: false })}</span>
                  <span style={{ color: entry.level === "error" ? C.red : entry.level === "success" ? C.green : entry.level === "warn" ? C.yellow : C.dim }}>{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}