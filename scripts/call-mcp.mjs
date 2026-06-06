// Call a Sorftime MCP tool: node scripts/call-mcp.mjs <toolName> '<jsonArgs>'
// Reads the key from env: SORFTIME_URL="https://mcp.sorftime.com?key=..." node scripts/call-mcp.mjs ...
const ENDPOINT = process.env.SORFTIME_URL;
if (!ENDPOINT) { console.error("set SORFTIME_URL env"); process.exit(1); }

let sessionId = null;
async function rpc(method, params, isNotification = false) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream" };
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
    for (const line of text.split("\n")) if (line.startsWith("data:")) { try { msgs.push(JSON.parse(line.slice(5).trim())); } catch {} }
  } else { try { msgs = [JSON.parse(text)]; } catch {} }
  return { msgs, raw: text };
}

const tool = process.argv[2];
const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};

(async () => {
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "alphapicker", version: "0.1" } });
  await rpc("notifications/initialized", undefined, true);
  const r = await rpc("tools/call", { name: tool, arguments: args });
  const msg = r.msgs.find((m) => m.result || m.error) || r.msgs[0];
  if (msg?.error) { console.log("ERROR:", JSON.stringify(msg.error)); return; }
  const content = msg?.result?.content;
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c.type === "text") {
        try { console.log(JSON.stringify(JSON.parse(c.text), null, 2)); }
        catch { console.log(c.text); }
      } else console.log(JSON.stringify(c));
    }
  } else {
    console.log(JSON.stringify(msg?.result ?? r.raw, null, 2));
  }
})().catch((e) => console.log("ERR", e.name, e.message));
