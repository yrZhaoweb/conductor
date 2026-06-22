import {
  createPublicKey,
  createHash,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify
} from "node:crypto";
import { existsSync, chmodSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { ensureDir, safeJoin } from "./paths.js";

export type SignatureBlock = {
  algorithm: "ed25519";
  keyId: string;
  value: string;
};

export function ensureSigningKeys(runRoot: string): void {
  const harnessDir = safeJoin(runRoot, ".harness");
  const publicPath = safeJoin(runRoot, ".harness", "acceptance-public-key.pem");
  const legacyPrivatePath = safeJoin(runRoot, ".harness", "acceptance-private-key.pem");
  const privatePath = privateKeyPathForRun(runRoot);
  ensureDir(harnessDir);
  ensureDir(path.dirname(privatePath));
  chmodSync(path.dirname(privatePath), 0o700);

  if (!existsSync(privatePath) && existsSync(legacyPrivatePath)) {
    writeFileSync(privatePath, readFileSync(legacyPrivatePath, "utf8"), { mode: 0o600 });
    chmodSync(privatePath, 0o600);
  }

  if (existsSync(privatePath)) {
    const publicPem = publicKeyFromPrivate(readFileSync(privatePath, "utf8"));
    writeFileSync(publicPath, publicPem);
    removeLegacyPrivateKey(legacyPrivatePath);
    return;
  }

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  writeFileSync(publicPath, publicKey.export({ type: "spki", format: "pem" }));
  writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), {
    mode: 0o600
  });
  chmodSync(privatePath, 0o600);
  removeLegacyPrivateKey(legacyPrivatePath);
}

export function signPayload(runRoot: string, payload: unknown): SignatureBlock {
  const privatePath = privateKeyPathForRun(runRoot);
  const publicPath = safeJoin(runRoot, ".harness", "acceptance-public-key.pem");
  const privatePem = readFileSync(privatePath, "utf8");
  const publicPem = readFileSync(publicPath, "utf8");
  const data = Buffer.from(stableStringify(payload));
  const signature = cryptoSign(null, data, privatePem).toString("base64");
  return {
    algorithm: "ed25519",
    keyId: sha256(publicPem),
    value: signature
  };
}

export function verifyPayload(runRoot: string, payload: unknown, signature: SignatureBlock): boolean {
  if (signature.algorithm !== "ed25519") {
    return false;
  }
  const publicPath = safeJoin(runRoot, ".harness", "acceptance-public-key.pem");
  const publicPem = readFileSync(publicPath, "utf8");
  if (signature.keyId !== sha256(publicPem)) {
    return false;
  }
  return cryptoVerify(
    null,
    Buffer.from(stableStringify(payload)),
    publicPem,
    Buffer.from(signature.value, "base64")
  );
}

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => {
    return a.localeCompare(b);
  });
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
}

export function keyPaths(runRoot: string): { publicPath: string; privatePath: string } {
  return {
    publicPath: path.join(runRoot, ".harness", "acceptance-public-key.pem"),
    privatePath: privateKeyPathForRun(runRoot)
  };
}

export function privateKeyPathForRun(runRoot: string): string {
  const baseDir = process.env.CONDUCTOR_HARNESS_KEY_DIR
    ? path.resolve(process.env.CONDUCTOR_HARNESS_KEY_DIR)
    : path.join(process.env.XDG_STATE_HOME ?? path.join(homedir(), ".local", "state"), "conductor", "harness-keys");
  const keyDir = path.join(baseDir, sha256(path.resolve(runRoot)));
  assertOutsideRunRoot(runRoot, keyDir);
  return path.join(keyDir, "acceptance-private-key.pem");
}

function publicKeyFromPrivate(privatePem: string): string {
  return createPublicKey(privatePem).export({ type: "spki", format: "pem" }).toString();
}

function removeLegacyPrivateKey(privatePath: string): void {
  if (existsSync(privatePath)) {
    unlinkSync(privatePath);
  }
}

function assertOutsideRunRoot(runRoot: string, candidatePath: string): void {
  const relative = path.relative(path.resolve(runRoot), path.resolve(candidatePath));
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error(`Acceptance private key path must be outside RUN_ROOT: ${candidatePath}`);
  }
}
