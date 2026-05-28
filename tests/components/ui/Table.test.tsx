// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table, TableHead, TableBody, TableRow, TableCell } from "@/app/components/ui/Table";
import { Inbox } from "lucide-react";

describe("Table", () => {
  it("renders children inside a table element", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Age</TableCell>
          </TableRow>
        </TableHead>
      </Table>,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
  });

  it("renders empty state when emptyState prop is provided", () => {
    render(
      <Table
        emptyState={{
          icon: Inbox,
          title: "No data",
          description: "Nothing to show",
        }}
      />,
    );
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("Nothing to show")).toBeInTheDocument();
  });

  it("renders empty state with no children when emptyState is provided", () => {
    render(
      <Table
        emptyState={{
          icon: Inbox,
          title: "Empty",
          description: "No items",
        }}
      >
        <TableBody>
          <TableRow>
            <TableCell>should not render</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.queryByText("should not render")).not.toBeInTheDocument();
  });
});

describe("TableCell hideBelow", () => {
  it("adds hidden class for sm breakpoint", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableCell hideBelow="sm">Mobile Hidden</TableCell>
          </TableRow>
        </TableHead>
      </Table>,
    );
    const cell = screen.getByText("Mobile Hidden");
    expect(cell.className).toContain("hidden");
    expect(cell.className).toContain("sm:table-cell");
  });

  it("adds hidden class for md breakpoint", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell hideBelow="md" />
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = screen.getByRole("cell");
    expect(cell.className).toContain("hidden");
    expect(cell.className).toContain("md:table-cell");
  });

  it("adds hidden class for lg breakpoint", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell hideBelow="lg" />
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = screen.getByRole("cell");
    expect(cell.className).toContain("hidden");
    expect(cell.className).toContain("lg:table-cell");
  });

  it("does not add hidden class without hideBelow", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Always Visible</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = screen.getByText("Always Visible");
    expect(cell.className).not.toContain("hidden");
  });

  it("preserves existing className when hideBelow is used", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="font-bold" hideBelow="sm">
              Bold & Hidden
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const cell = screen.getByText("Bold & Hidden");
    expect(cell.className).toContain("font-bold");
    expect(cell.className).toContain("hidden");
  });
});
