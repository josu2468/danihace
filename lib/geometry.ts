import PerspT from 'perspective-transform';

/**
 * Calculates the CSS matrix3d string to transform a rectangle of size (width, height)
 * into the quadrilateral defined by 4 points (tl, tr, br, bl).
 * 
 * @param width Width of the source image/element
 * @param height Height of the source image/element
 * @param points Array of 4 points [tl, tr, br, bl] where each point is {x, y}
 */
export function getPerspectiveTransform(
    width: number,
    height: number,
    points: { x: number; y: number }[]
): string {
    // Source points: [tl, tr, br, bl] (standard rectangle)
    const srcPoints = [
        0, 0,           // top-left
        width, 0,       // top-right
        width, height,  // bottom-right
        0, height       // bottom-left
    ];

    // Destination points from the 4 corners provided
    const dstPoints = points.flatMap(p => [p.x, p.y]);

    try {
        const transform = PerspT(srcPoints, dstPoints);
        const coeffs = transform.coeffs; // 3x3 matrix flattened: [a, b, c, d, e, f, g, h, i] (row major usually, but library specific)

        // perspective-transform returns coefficients for the matrix:
        // a b c
        // d e f
        // g h i
        //
        // Mapping to CSS matrix3d(a1, b1, c1, d1, a2, b2, c2, d2, a3, b3, c3, d3, a4, b4, c4, d4)
        // CSS matrix3d represents column-major order:
        // a1 a2 a3 a4
        // b1 b2 b3 b4
        // c1 c2 c3 c4
        // d1 d2 d3 d4
        // 
        // The homography maps (x, y, 1) to (x', y', w').
        // 
        // We map:
        // a -> a1 (scale x)
        // d -> b1 (skew y)
        // 0 -> c1
        // g -> d1 (perspective x)
        //
        // b -> a2 (skew x)
        // e -> b2 (scale y)
        // 0 -> c2
        // h -> d2 (perspective y)
        // 
        // 0 -> a3
        // 0 -> b3
        // 1 -> c3
        // 0 -> d3
        //
        // c -> a4 (translate x)
        // f -> b4 (translate y)
        // 0 -> c4
        // i -> d4 (perspective w / scale w)

        // Coefficients from perspective-transform are:
        // [a, b, c, d, e, f, g, h, i]
        // corresponding to:
        // | a b c |
        // | d e f |
        // | g h i |

        // Wait, let's verify perspective-transform output order.
        // Usually it is:
        // X = (ax + by + c) / (gx + hy + i)
        // Y = (dx + ey + f) / (gx + hy + i)

        // So the matrix is:
        // a b c
        // d e f
        // g h i

        // CSS transforms are:
        // matrix3d(a1, b1, 0, d1, a2, b2, 0, d2, 0, 0, 1, 0, a4, b4, 0, d4)
        // where:
        // x' = a1*x + a2*y + a4
        // y' = b1*x + b2*y + b4
        // w' = d1*x + d2*y + d4

        // So mapping:
        // a -> a1
        // b -> a2
        // c -> a4
        // d -> b1
        // e -> b2
        // f -> b4
        // g -> d1
        // h -> d2
        // i -> d4

        return `matrix3d(
      ${coeffs[0]}, ${coeffs[3]}, 0, ${coeffs[6]},
      ${coeffs[1]}, ${coeffs[4]}, 0, ${coeffs[7]},
      0, 0, 1, 0,
      ${coeffs[2]}, ${coeffs[5]}, 0, ${coeffs[8]}
    )`;
    } catch (e) {
        console.error("Failed to calculate perspective transform", e);
        return 'none';
    }
}

/**
 * Calculates the real-world scale (pixels per cm) based on a reference line.
 */
export function calculatePxPerCm(
    pixelLength: number,
    realLengthCm: number
): number {
    if (realLengthCm <= 0) return 0;
    return pixelLength / realLengthCm;
}
