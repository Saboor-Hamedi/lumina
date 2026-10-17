# Fix Mermaid Flowchart Scaling and Centering in Lumina

## Problem

Mermaid rendering is working perfectly in Lumina. The diagrams are generated correctly, and there are no issues with their content or functionality.

However, the rendered flowcharts have a significant visual presentation problem.

As shown in the screenshots:

- The Mermaid container is large, but the actual flowchart occupies only a tiny portion of it.
- The diagram is positioned near the top of the container instead of being centered.
- There is excessive empty space surrounding the diagram, particularly below it.
- Increasing the container's height does not make the diagram larger.
- The flowchart remains small regardless of how much space is available.

This makes the diagrams difficult to read and wastes valuable screen space.

## Expected Behavior

I want Mermaid diagrams to look polished, readable, and professionally integrated into Lumina.

1. **Proper scaling:** The flowchart should use the available container space effectively. It should not remain tiny when the container is large.

2. **Horizontal and vertical centering:** The entire diagram should be centered within its rendering area, both horizontally and vertically.

3. **Responsive sizing:** The diagram should adapt to the available width and height when the container is resized.

4. **Readable nodes and text:** Node labels, connections, and text should remain comfortably readable. Do not simply enlarge the container while leaving the SVG diagram unchanged.

5. **Preserve the aspect ratio:** Scale the diagram proportionally without stretching or distorting it.

6. **Handle different diagram sizes:** Small, wide, tall, and complex flowcharts should all render appropriately. A very wide diagram should not be forced into a tiny scale merely because its height is large, and a tall diagram should not be unnecessarily constrained by its width.

7. **Keep existing functionality intact:** Mermaid generation, syntax, diagram content, interactions, and existing controls must continue to work.

## Investigate the Actual Cause

Before making changes, inspect Lumina's existing Mermaid rendering implementation.

Determine whether the issue comes from:

- The SVG's intrinsic width and height or its `viewBox`.
- Mermaid's `useMaxWidth` or other initialization settings.
- CSS rules controlling the SVG's width, height, maximum dimensions, or transforms.
- The layout of the Mermaid container and its child elements.
- The SVG's default sizing behavior, which can leave the rendered diagram at its intrinsic dimensions.
- Incorrect calculations of the diagram's bounding box or available rendering space.
- The difference between enlarging the outer container and actually scaling the SVG content.

Do not assume that any one of these is the cause. Trace the existing implementation and establish what is happening.

## Implementation Objective

Once the cause is established, implement a robust solution that makes the diagram itself occupy an appropriate amount of the available rendering area and positions it in the center.

Use the existing rendering architecture wherever possible. Avoid introducing unnecessary dependencies or rebuilding the Mermaid integration.

The solution should distinguish between the container's dimensions and the SVG diagram's actual dimensions. Centering the container alone is insufficient if the diagram remains intrinsically small.

If appropriate for the existing implementation, consider measuring the rendered SVG's actual dimensions and `viewBox`, then calculating a proportional scale that respects the available width and height. Ensure that resizing does not cause repeated scaling, layout loops, clipping, or distortion.

Do not apply an aggressive fixed zoom to every diagram. Choose a sizing strategy that works across different flowchart shapes and complexity levels.

## Validation

Test the result using:

- A small flowchart.
- A wide flowchart with many sequential nodes.
- A tall flowchart with multiple levels.
- A complex flowchart with nested subgraphs.
- A resized Mermaid container.

Verify that the diagram is centered, readable, proportionally scaled, and not clipped in each case.

Also verify that existing Mermaid rendering and controls remain functional.

**Important:** Do not confuse a larger rendering container with a larger diagram. The objective is to make the actual flowchart visible at an appropriate scale, centered in the available space.

After implementation, report the root cause, the files changed, the sizing strategy used, and the tests performed.
