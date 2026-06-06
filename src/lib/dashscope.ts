// Aliyun DashScope (通义千问 Qwen-VL) vision client — recognises a product image
// and returns structured fields to auto-fill the new-evaluation form.
// Uses the OpenAI-compatible endpoint. Docs: help.aliyun.com/zh/model-studio/models

const ENDPOINT =
  "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

// Tried in order; the first the key can access wins (max-* may be gated).
const MODELS = (process.env.DASHSCOPE_VL_MODELS ?? "qwen-vl-max-latest,qwen-vl-plus")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export interface ProductGuess {
  name: string;
  category_path: string;
  main_keyword: string;
  secondary_keywords: string[];
  target_market: string;
  est_price_usd: number;
  confidence: number;
  model: string;
}

const PROMPT = `你是跨境电商选品助手。识别图中的实物产品（忽略背景/包装文字水印），输出严格 JSON，不要任何解释、不要代码块：
{"name":"简洁、可上架的英文产品标题(不超过90字符)","category_path":"亚马逊类目路径，用 › 分隔，如 Pet Supplies › Bowls › Slow Feed","main_keyword":"核心英文搜索关键词(全小写)","secondary_keywords":["次要英文词1","次要英文词2","次要英文词3"],"target_market":"Amazon US","est_price_usd":典型零售价数字(美元),"confidence":0到1之间的小数}`;

function parseJson(text: string): Record<string, unknown> {
  const t = text.trim().replace(/^```json?/i, "").replace(/```$/g, "").trim();
  const m = t.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : t);
}

/** `image` may be a public URL or a data: URI (base64). */
export async function analyzeProductImage(image: string): Promise<ProductGuess> {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) throw new Error("DASHSCOPE_API_KEY 未配置");

  let lastErr = "未知错误";
  for (const model of MODELS) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = await res.json();
    if (!res.ok || !data.choices) {
      lastErr = JSON.stringify(data.error ?? data).slice(0, 200);
      // model gated → try the next one; other errors → stop
      if (data?.error?.code === "access_denied" || res.status === 404) continue;
      throw new Error(`DashScope 调用失败: ${lastErr}`);
    }
    const raw = data.choices[0]?.message?.content ?? "";
    let obj: Record<string, unknown>;
    try {
      obj = parseJson(String(raw));
    } catch {
      throw new Error("视觉模型未返回可解析的 JSON");
    }
    const sk = obj.secondary_keywords;
    return {
      name: String(obj.name ?? "").slice(0, 90),
      category_path: String(obj.category_path ?? ""),
      main_keyword: String(obj.main_keyword ?? "").toLowerCase(),
      secondary_keywords: Array.isArray(sk) ? sk.map(String).slice(0, 6) : [],
      target_market: String(obj.target_market ?? "Amazon US"),
      est_price_usd: Number(obj.est_price_usd ?? 0) || 0,
      confidence: Number(obj.confidence ?? 0) || 0,
      model,
    };
  }
  throw new Error(`DashScope: 无可用视觉模型 (${lastErr})`);
}
