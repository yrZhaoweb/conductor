export const EXIT = {
  OK: 0,
  USAGE: 10,
  FENCE: 20,
  REDLINE: 30,
  ACCEPTANCE: 40,
  RUNTIME: 50,
  GIT: 60
} as const;

export class HarnessError extends Error {
  readonly code: number;

  constructor(code: number, message: string) {
    super(message);
    this.name = "HarnessError";
    this.code = code;
  }
}
