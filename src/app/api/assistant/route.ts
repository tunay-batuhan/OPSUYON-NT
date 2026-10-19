import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { menuFor } from "@/lib/menu";
import { getEnabledModules } from "@/lib/modules";
import { ASSISTANT_GUIDE } from "@/lib/assistant/guide";
import { userContext } from "@/lib/assistant/prompt";

export const maxDuration = 60;

const MODEL = "claude-haiku-5-5";
const MAX_MESSAGES = 20;
const MAX_CHARS = 2000;

type Msg = { role: "user" | "assistant"; content: string };

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * Opsüyon AI: oturum açmış kullanıcıya portalın kullanımını anlatan yardım asistanı (test aşaması).
 * Veritabanına erişmez ve işlem yapmaz; yalnızca rehber metni ve kullanıcının menüsüyle yanıt verir.
 * Yanıt düz metin olarak akıtılır.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Oturum gerekli." }, 401);

  const enabled = await getEnabledModules();
  if (!enabled.has("opsuyon_ai")) return json({ error: "Asistan kapalı." }, 404);

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return json({ error: "Asistan henüz yapılandırılmamış." }, 503);

  let body: { messages?: unknown; path?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz istek." }, 400);
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages: Msg[] = raw
    .filter((m): m is Msg => !!m && typeof m === "object" && ((m as Msg).role === "user" || (m as Msg).role === "assistant") && typeof (m as Msg).content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS).trim() }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_MESSAGES);
  // API, sohbetin kullanıcı mesajıyla başlamasını ve son mesajın kullanıcıdan olmasını ister
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return json({ error: "Soru boş." }, 400);

  const path = typeof body.path === "string" ? body.path.slice(0, 200) : "";
  const context = userContext(user, menuFor(user, enabled), path);

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const run = client.messages.stream({
          model: MODEL,
          max_tokens: 1500,
          // Rehber sabit olduğu için önbelleğe alınır; kullanıcı bağlamı her istekte değişir.
          system: [
            { type: "text", text: ASSISTANT_GUIDE, cache_control: { type: "ephemeral" } },
            { type: "text", text: context },
          ],
          messages,
        });
        for await (const ev of run) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") controller.enqueue(encoder.encode(ev.delta.text));
        }
      } catch (e) {
        console.error("assistant error", e instanceof Error ? e.message : e);
        controller.enqueue(encoder.encode("\n\n⚠️ Şu an yanıt veremiyorum. Lütfen biraz sonra tekrar deneyin."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
