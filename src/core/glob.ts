export function matchesAnyPattern(filePath: string, patterns: string[]): string | undefined {
  const normalized = normalizePath(filePath);
  return patterns.find((pattern) => matchesPattern(normalized, pattern));
}

export function matchesPattern(filePath: string, pattern: string): boolean {
  const normalizedPath = normalizePath(filePath);
  const normalizedPattern = normalizePath(pattern);
  if (!normalizedPattern.includes("/")) {
    return new RegExp(`^${globPartToRegExp(normalizedPattern)}$`).test(basename(normalizedPath));
  }
  return new RegExp(`^${globToRegExp(normalizedPattern)}$`).test(normalizedPath);
}

function globToRegExp(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    const next = pattern[i + 1];
    if (char === "*" && next === "*") {
      const after = pattern[i + 2];
      if (after === "/") {
        out += "(?:.*/)?";
        i += 2;
      } else {
        out += ".*";
        i += 1;
      }
      continue;
    }
    if (char === "*") {
      out += "[^/]*";
      continue;
    }
    out += escapeRegExp(char);
  }
  return out;
}

function globPartToRegExp(pattern: string): string {
  return pattern.split("*").map(escapeRegExp).join(".*");
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function basename(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? filePath;
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
