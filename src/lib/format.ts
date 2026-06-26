export const currency = (n: number) =>
  `$${n.toFixed(2)}`;

export const cn = (...c: Array<string | false | null | undefined>) =>
  c.filter(Boolean).join(" ");
