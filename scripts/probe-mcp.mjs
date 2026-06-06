// Probe the Sorftime MCP server: initialize -> tools/list -> dump schemas
// Reads the key from env: SORFTIME_URL="https://mcp.sorftime.com?key=..." node scripts/probe-mcp.mjs
const ENDPOINT = process.env.SORFTIME_URL;
if (!ENDPOINT) { console.error("set SORFTIME_URL env"); process.exit(1); }

let sessionId = null;

async function rpc(method, params, isNotification = false) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const body = { jsonrpc: "2.0", method, ...(isNotification ? {} : { id: Math.floor(Math.random() * 1e6) }) };
  if (params !== undefined) body.params = params;

  const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (isNotification) return {};
  let msgs = [];
  if (ct.includes("text/event-stream")) {
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) { try { msgs.push(JSON.parse(line.slice(5).trim())); } catch {} }
    }
  } else { try { msgs = [JSON.parse(text)]; } catch {} }
  return { msgs, raw: text };
}

(async () => {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "alphapicker", version: "0.1" } });
  await rpc("notifications/initialized", undefined, true);
  const tl = await rpc("tools/list", {});
  const list = (tl.msgs.find((m) => m.result) || {}).result?.tools || [];

  console.log("TOTAL TOOLS:", list.length, "\n");
  console.log("ALL NAMES:\n" + list.map((t) => t.name).join(", "));

  const filter = process.env.FILTER || "asin|keyword|product_detail|review|relation|reverse|node|aba|category|potential";
  const re = new RegExp(filter, "i");
  const skip = /shopee|tiktok|walmart/i;
  console.log("\n\n=== SCHEMAS (filter: " + filter + ") ===");
  for (const t of list) {
    if (!re.test(t.name) || skip.test(t.name)) continue;
    console.log("\n• " + t.name + "\n  " + (t.description || "").slice(0, 220));
    const p = t.inputSchema?.properties || {};
    const req = t.inputSchema?.required || [];
    for (const k of Object.keys(p)) {
      console.log("   - " + k + " (" + (p[k].type || "?") + (req.includes(k) ? "*" : "") + "): " + (p[k].description || "").slice(0, 80));
    }
  }
})().catch((e) => console.log("ERR", e.name, e.message));
