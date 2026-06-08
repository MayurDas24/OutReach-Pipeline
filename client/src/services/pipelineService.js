const BASE = "http://localhost:5000/api/pipeline";

export const runPipeline = async (domain) => {
  const res = await fetch(`${BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};

export const sendApproved = async (contacts) => {
  const res = await fetch(`${BASE}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contacts }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
};