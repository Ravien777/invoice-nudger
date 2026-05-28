import { describe, it, expect } from "vitest";
import { SYSTEM_TEMPLATES, renderContractTemplate, extractVariables } from "@/lib/contract-templates";

describe("SYSTEM_TEMPLATES", () => {
  it("exports three system templates", () => {
    expect(SYSTEM_TEMPLATES).toHaveLength(3);
  });

  it("each template has name and body with variables", () => {
    for (const tmpl of SYSTEM_TEMPLATES) {
      expect(tmpl.name).toBeTruthy();
      expect(tmpl.body).toContain("{{");
    }
  });
});

describe("renderContractTemplate", () => {
  it("replaces variables in template body", () => {
    const body = "<p>Agreement with {{clientName}} for {{amount}}</p>";
    const vars = { clientName: "Acme Corp", amount: "$5,000" };
    const result = renderContractTemplate(body, vars);
    expect(result).toContain("Acme Corp");
    expect(result).toContain("$5,000");
    expect(result).not.toContain("{{clientName}}");
  });

  it("leaves missing variables as-is", () => {
    const body = "Hello {{name}}";
    const result = renderContractTemplate(body, {});
    expect(result).toBe("Hello {{name}}");
  });

  it("replaces the same variable multiple times", () => {
    const body = "{{x}} and {{x}}";
    const result = renderContractTemplate(body, { x: "foo" });
    expect(result).toBe("foo and foo");
  });

  it("passes variable values through as-is (legitimate HTML)", () => {
    const body = "<p>{{description}}</p>";
    const result = renderContractTemplate(body, { description: "<strong>Important</strong>" });
    expect(result).toContain("<strong>Important</strong>");
    expect(result).not.toContain("{{description}}");
  });
});

describe("extractVariables", () => {
  it("extracts unique variable names from body", () => {
    const body = "<p>{{clientName}} and {{amount}} and {{clientName}}</p>";
    const vars = extractVariables(body);
    expect(vars).toEqual(["clientName", "amount"]);
  });

  it("returns empty array when no variables", () => {
    expect(extractVariables("<p>No variables here</p>")).toEqual([]);
  });
});
