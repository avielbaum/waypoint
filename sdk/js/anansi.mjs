// Anansi game SDK for JavaScript and TypeScript (types in anansi.d.ts). Browsers, Node 18+, Deno, Bun, Electron.
// Same contract as sdk/anansi_client.py and sdk/unity/Anansi.cs: ask the gateway, and on a timeout, a 429, an auth
// error or any failure answer from the fallback so the game never stalls. Every result has source "gateway" or "fallback".
// Browsers: list the page's origin in the gateway's cors_origins (or use a same-origin proxy), and never ship a title
// key to browsers you do not control.

export class Anansi {
  /**
   * @param {object} o
   * @param {string} o.baseUrl   gateway URL, e.g. https://gateway.example
   * @param {string} o.title     title id
   * @param {string} o.key       title key
   * @param {string | (() => string | Promise<string>)} o.playerToken  proof of who the player is, from your platform;
   *        pass a function if it expires (on Steam, the hex web-API auth ticket)
   * @param {(messages: object[]) => string | Promise<string>} [o.fallback]  local answer when the gateway cannot (default "...")
   */
  constructor(o) {
    this.base = o.baseUrl.replace(/\/+$/, "");
    this.title = o.title;
    this.key = o.key;
    this.playerToken = o.playerToken;
    this.fallback = o.fallback || (() => "...");
    this.questFallback = o.questFallback; // (world) => quest | null: an authored quest when the gateway cannot
    this.storylineFallback = o.storylineFallback;
    this.timeoutMs = o.timeoutMs ?? 3000; // plain reply, or the first sentence of a stream
    this.streamTimeoutMs = o.streamTimeoutMs ?? 30000; // a whole streamed reply once it has started
    this.generationTimeoutMs = o.generationTimeoutMs ?? 60000; // quests/storylines are slow: use them on loading screens
    this.fetch = o.fetch || globalThis.fetch.bind(globalThis);
  }

  async _headers() {
    const t = typeof this.playerToken === "function" ? await this.playerToken() : this.playerToken;
    return { "Content-Type": "application/json", "X-Anansi-Title": this.title, "X-Anansi-Key": this.key, "X-Player-Token": t || "" };
  }

  async _post(path, body, timeoutMs) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await this.fetch(this.base + path, { method: "POST", headers: await this._headers(), body: JSON.stringify(body), signal: ctl.signal });
      return r.status === 200 ? await r.json() : null;
    } catch (e) {
      return null; // timeout, DNS, TLS, bad JSON: every failure means "use the fallback"
    } finally {
      clearTimeout(timer);
    }
  }

  async _call(method, path, body) { // [status, json]; status 0 when the gateway could not be reached
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const r = await this.fetch(this.base + path, { method, headers: await this._headers(), body: body && JSON.stringify(body), signal: ctl.signal });
      return [r.status, r.status === 200 ? await r.json() : await r.json().catch(() => null)];  // an error's body says why
    } catch (e) {
      return [0, null];
    } finally {
      clearTimeout(timer);
    }
  }

  /** Volunteer credits of this player: {balance, pending, nodes}, or null when the gateway cannot be reached. */
  async credits() {
    const [s, d] = await this._call("GET", "/v1/credits");
    return s === 200 ? { balance: d.balance, pending: d.pending, nodes: d.nodes } : null;
  }

  /**
   * Link the machine that printed `code` (ABCD-EFGH, from the node agent's --link) to this player.
   * {linked: true, balance, pending, nodes}, or {linked: false, reason: "bad_code" (unknown, used or expired) | "unavailable"}.
   * Spending is not here: only your game server may spend, with the title's server key.
   */
  async linkNode(code) {
    const [s, d] = await this._call("POST", "/v1/credits/link", { code: String(code) });
    if (s === 200) return { linked: true, balance: d.balance, pending: d.pending, nodes: d.nodes };
    return { linked: false, reason: s === 404 || s === 400 ? "bad_code" : "unavailable" };
  }

  /** The anonymous volunteer-network statistics for `period` ("day", "week", "all"), or null when the gateway cannot be reached:
   *  {period, published, min_group, reporting: {machines, tokens, idle_gpu_pct}, network_tokens, gpus, cpus, systems}, each row
   *  {name, machines, tokens, idle_gpu_pct}. Nothing is published (published is false, the rest empty) until at least min_group machines
   *  report, and a smaller group is folded into "Other". The names are hardware names reported by machines: escape them in markup. */
  async leaderboard({ period = "week", limit = 20 } = {}) {
    const [s, d] = await this._call("GET", `/v1/leaderboard?period=${encodeURIComponent(period)}&limit=${Number(limit) | 0}`);
    return s === 200 ? d : null;
  }

  async _fallbackReply(messages) {
    return { source: "fallback", say: String(await this.fallback(messages)), action: "none", filtered: false };
  }

  /** One reply: {source, say, action, filtered}. With structured, action is one of the title's whitelisted actions or "none". */
  async chat(messages, { npcId, structured = false } = {}) {
    const body = { messages, structured };
    if (npcId) body.npc_id = npcId;
    const r = await this._post("/v1/npc", body, this.timeoutMs);
    if (r && typeof r.say === "string" && r.say) {
      return { source: "gateway", say: r.say, action: r.action || "none", filtered: !!r.filtered };
    }
    return this._fallbackReply(messages);
  }

  /**
   * The reply one finished sentence at a time: onSentence(text) runs for each as it arrives. If the gateway fails
   * before the first sentence, onSentence gets the fallback line once; after text was shown, that text stands.
   */
  async chatStream(messages, onSentence, { npcId } = {}) {
    let said = "";
    let filtered = false;
    const ctl = new AbortController();
    let timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const body = { stream: true, anansi: { npc_id: npcId || null }, messages };
      const r = await this.fetch(this.base + "/v1/chat/completions", { method: "POST", headers: await this._headers(), body: JSON.stringify(body), signal: ctl.signal });
      if (r.status === 200 && r.body) {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let stop = false;
        while (!stop) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line.startsWith("data: {")) continue;
            if (line.startsWith('data: {"error"')) { stop = true; break; } // the gateway could not serve the stream
            const d = JSON.parse(line.slice(6));
            if (d.anansi?.filtered) filtered = true; // the gateway replaced unsafe text (said in the first or last chunk)
            const text = d.choices?.[0]?.delta?.content;
            if (!text) continue;
            if (!said) { clearTimeout(timer); timer = setTimeout(() => ctl.abort(), this.streamTimeoutMs); }
            said += text;
            onSentence(text);
          }
        }
      }
    } catch (e) {
      // timeout, dropped connection, bad JSON: what was said stands
    } finally {
      clearTimeout(timer);
    }
    if (said) return { source: "gateway", say: said, action: "none", filtered };
    const fb = await this._fallbackReply(messages);
    onSentence(fb.say);
    return fb;
  }

  /**
   * One quest that can only use the characters, places and items in `world`:
   * {npcs: [{id, name, role}], locations: [...], items: [...]}. Returns {source, quest}; quest is null on fallback
   * unless questFallback is set. The reward is a tier (small, medium, large): map it to your own loot.
   */
  async quest(world, { steps = 3, theme = "", difficulty = "normal", storySoFar = "", player = "" } = {}) {
    const r = await this._post("/v1/quest", { world, steps, theme, difficulty, story_so_far: storySoFar, player }, this.generationTimeoutMs);
    if (r && r.quest) return { source: "gateway", quest: r.quest };
    return { source: "fallback", quest: this.questFallback ? await this.questFallback(world) : null };
  }

  async storyline(world, { beats = 4, theme = "" } = {}) {
    const r = await this._post("/v1/storyline", { world, steps: beats, theme, difficulty: "normal", story_so_far: "", player: "" }, this.generationTimeoutMs);
    if (r && r.storyline) return { source: "gateway", storyline: r.storyline };
    return { source: "fallback", storyline: this.storylineFallback ? await this.storylineFallback(world) : null };
  }
}
