import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import ts from "typescript";

const ACTIVE_UI_ROOTS = ["app", "components", "lib"] as const;
const SOURCE_EXTENSION = /\.[cm]?[jt]sx?$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const FORBIDDEN_CUSTOMER_TERM = /\bpilot\b/iu;

function listActiveSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listActiveSourceFiles(absolutePath);
    if (!SOURCE_EXTENSION.test(entry.name) || TEST_FILE.test(entry.name) || entry.name.endsWith(".d.ts")) {
      return [];
    }
    return [absolutePath];
  });
}

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) return node.text;
  if (
    node.kind === ts.SyntaxKind.TemplateHead ||
    node.kind === ts.SyntaxKind.TemplateMiddle ||
    node.kind === ts.SyntaxKind.TemplateTail
  ) {
    return (node as ts.TemplateLiteralLikeNode).text;
  }
  return null;
}

describe("customer-visible copy", () => {
  it("does not expose pilot wording in active app, component, or UI content sources", () => {
    const repositoryRoot = process.cwd();
    const violations: string[] = [];

    for (const root of ACTIVE_UI_ROOTS) {
      for (const filePath of listActiveSourceFiles(path.join(repositoryRoot, root))) {
        const sourceText = readFileSync(filePath, "utf8");
        const sourceFile = ts.createSourceFile(
          filePath,
          sourceText,
          ts.ScriptTarget.Latest,
          true,
          filePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );

        const visit = (node: ts.Node) => {
          const text = literalText(node);
          if (text && FORBIDDEN_CUSTOMER_TERM.test(text)) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            violations.push(`${path.relative(repositoryRoot, filePath)}:${line}: ${text.trim()}`);
          }
          ts.forEachChild(node, visit);
        };
        visit(sourceFile);
      }
    }

    assert.deepEqual(violations, [], `Customer-visible pilot wording found:\n${violations.join("\n")}`);
  });
});
