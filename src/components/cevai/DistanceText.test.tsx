import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DistanceText } from "./DistanceText";
afterEach(cleanup);
describe("distance display", () => {
  it.each([NaN, Infinity, -1])("removes words, separators, icon and wrapper for %s", km => {
    const { container } = render(<DistanceText as="p" km={km} prefix="· " suffix=" de você"><i>GPS</i></DistanceText>);
    expect(container).toBeEmptyDOMElement();
  });
  it("keeps the original text, wrapper and styling for valid distance", () => {
    const { container } = render(<DistanceText as="p" className="mt-1 text-xs" km={0.155} suffix=" de você" />);
    expect(container.firstChild).toHaveTextContent("155 m de você");
    expect(container.querySelector("p")).toHaveClass("mt-1", "text-xs");
  });
});
