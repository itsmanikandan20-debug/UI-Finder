import { describe, expect, it } from "vitest";
import { parseEnvFile } from "../load-env";

describe("parseEnvFile", () => {
  it("parses simple KEY=value lines", () => {
    expect(parseEnvFile("DATABASE_URL=postgres://localhost/db\nGEMINI_API_KEY=abc123")).toEqual({
      DATABASE_URL: "postgres://localhost/db",
      GEMINI_API_KEY: "abc123",
    });
  });

  it("skips blank lines and comments", () => {
    expect(parseEnvFile("# a comment\n\nDATABASE_URL=postgres://x\n  # indented comment\n")).toEqual({
      DATABASE_URL: "postgres://x",
    });
  });

  it("skips lines with no '=' and lines with an empty key", () => {
    expect(parseEnvFile("not a valid line\n=no-key\nDATABASE_URL=postgres://x")).toEqual({
      DATABASE_URL: "postgres://x",
    });
  });

  it("treats a value-less KEY= line as an empty string, not missing", () => {
    expect(parseEnvFile("SEARCH_PREFILTER_LIMIT=\nDATABASE_URL=postgres://x")).toEqual({
      SEARCH_PREFILTER_LIMIT: "",
      DATABASE_URL: "postgres://x",
    });
  });

  it("strips a single layer of matching quotes around the value", () => {
    expect(parseEnvFile('DATABASE_URL="postgres://x"\nGEMINI_API_KEY=\'abc\'')).toEqual({
      DATABASE_URL: "postgres://x",
      GEMINI_API_KEY: "abc",
    });
  });

  it("keeps '=' characters that appear after the first one (connection strings, keys with '=' padding)", () => {
    expect(parseEnvFile("DATABASE_URL=postgres://user:pass@host/db?x=1")).toEqual({
      DATABASE_URL: "postgres://user:pass@host/db?x=1",
    });
  });
});
