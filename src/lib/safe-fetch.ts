import "server-only";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const MAX_REDIRECTS = 5;

export class FetchError extends Error {}

// 內網、本機與保留位址（避免伺服器被拿來存取內部服務）。
// BlockList 能正確比對各種 IPv6 寫法，包含 ::ffff:7f00:1 這類 IPv4-mapped 位址
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

function isPrivateAddress(ip: string) {
  return blocked.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4");
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("只支援 http / https 網址");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new FetchError("不允許的網址");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new FetchError("不允許的網址");
  }
}

/** 依 Content-Type 或 <meta charset> 解碼，支援 Big5、GBK 等非 UTF-8 網頁 */
function decode(bytes: Uint8Array, contentType: string | null) {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
  const fromMeta =
    head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] ??
    head.match(/<\?xml[^>]+encoding=["']([\w-]+)/i)?.[1];
  for (const label of [fromHeader, fromMeta, "utf-8"]) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(bytes);
    } catch {
      // 不認得的編碼就試下一個
    }
  }
  return new TextDecoder().decode(bytes);
}

/**
 * 抓取外部網址並回傳文字內容。
 * 每一次轉址都會重新檢查目標，避免經由轉址連到內網。
 */
export async function safeFetchText(
  input: string,
  { accept, maxBytes, timeoutMs = 10_000 }: { accept: string; maxBytes: number; timeoutMs?: number },
) {
  let url = new URL(input);
  const signal = AbortSignal.timeout(timeoutMs);

  for (let hop = 0; ; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PersonalNotesApp/1.0)",
        Accept: accept,
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
      redirect: "manual",
      signal,
      cache: "no-store",
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (hop >= MAX_REDIRECTS) throw new FetchError("轉址次數過多");
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    if (!res.ok) throw new FetchError(`HTTP ${res.status}`);

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new FetchError("內容過大");

    // 串流讀取，超過上限就中止
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new FetchError("內容過大");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }

    return {
      url: url.toString(),
      contentType: res.headers.get("content-type"),
      text: decode(bytes, res.headers.get("content-type")),
    };
  }
}
