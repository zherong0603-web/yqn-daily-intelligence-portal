export function sourceDomain(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export function normalizeUrl(input: string): string {
  try {
    const url = new URL(input);
    url.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return input.trim();
  }
}

export function stableId(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return `i_${Math.abs(hash).toString(36)}`;
}
