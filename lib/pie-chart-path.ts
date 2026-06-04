/** SVG path for a pie slice; uses two semicircles when the slice spans a full turn. */
export function pieSlicePath(
  center: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  const angle = endAngle - startAngle;
  const x1 = center + radius * Math.cos(startAngle);
  const y1 = center + radius * Math.sin(startAngle);

  if (angle >= 2 * Math.PI - 1e-9) {
    const x2 = center + radius * Math.cos(startAngle + Math.PI);
    const y2 = center + radius * Math.sin(startAngle + Math.PI);
    return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} A ${radius} ${radius} 0 0 1 ${x1} ${y1} Z`;
  }

  const x2 = center + radius * Math.cos(endAngle);
  const y2 = center + radius * Math.sin(endAngle);
  const largeArc = angle > Math.PI ? 1 : 0;
  return `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}
