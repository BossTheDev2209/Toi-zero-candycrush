export type Verdict = "AC" | "WA" | "TLE" | "RE" | "CE";
export type Language = "c" | "cpp" | "py";

export interface CompilerConfig {
  bin: string;
  flags: string[];
}
