/** The colour field glides the hue as a plain number, so 350 to 10 would sweep through the whole wheel the long way.
 *  Return an equivalent hue (it may go below 0 or above 360; hsl() accepts both) that is at most 180 degrees from `prev`. */
export function unwrapHue(prev: number, next: number): number {
  return prev + ((((next - prev) % 360) + 540) % 360) - 180;
}
