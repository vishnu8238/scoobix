export const currency = (n: number) =>
  `$${n.toFixed(2)}`;

export const formatPrice = (n: number) =>
  n >= 1000 ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${n.toFixed(2)}`;

export const cn = (...c: Array<string | false | null | undefined>) =>
  c.filter(Boolean).join(" ");
