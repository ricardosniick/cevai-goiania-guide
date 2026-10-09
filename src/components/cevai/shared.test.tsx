import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Bookmark } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmptyState, PlacePhoto } from "./shared";

afterEach(cleanup);

describe("PlacePhoto loading", () => {
  it("keeps a successfully loaded photo through unrelated renders", () => {
    const { rerender } = render(<PlacePhoto src="/first.jpg" alt="Lugar" />);
    const image = screen.getByRole("img");
    fireEvent.load(image);
    rerender(<PlacePhoto src="/first.jpg" alt="Lugar atualizado" />);
    expect(screen.getByRole("img")).toBe(image);
  });

  it("falls back on failure and allows a different photo to load", () => {
    const { rerender } = render(<PlacePhoto src="/expired.jpg" alt="Lugar" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
    rerender(<PlacePhoto src="/renewed.jpg" alt="Lugar" />);
    expect(screen.getByRole("img").getAttribute("src")).toBe("/renewed.jpg");
    fireEvent.load(screen.getByRole("img"));
    expect(screen.getByRole("img").getAttribute("src")).toBe("/renewed.jpg");
  });
});

describe("empty state action", () => {
  it("executes its connected action exactly once per click", () => {
    const onAction = vi.fn();
    render(<EmptyState icon={Bookmark} title="" text="" action="Explorar" onAction={onAction} />);
    expect(onAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});