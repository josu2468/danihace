declare module 'perspective-transform' {
  export interface PerspectiveTransform {
    transform(x: number, y: number): { x: number; y: number };
    transformInverse(x: number, y: number): { x: number; y: number };
    srcPts: number[];
    dstPts: number[];
    coeffs: number[];
    coeffsInv: number[];
  }

  function PerspT(
    srcPts: [number, number, number, number, number, number, number, number] | number[],
    dstPts: [number, number, number, number, number, number, number, number] | number[]
  ): PerspectiveTransform;

  export default PerspT;
}
