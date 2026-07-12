import type { QrOptionGroup } from "@/lib/qr-order/types";

/**
 * Client-only option templates keyed by product name patterns.
 * Selections are written into the order note; server still charges catalog price.
 */
const TEMPLATES: Array<{ match: RegExp; groups: QrOptionGroup[] }> = [
  {
    match: /burger|tavuk|pizza|makarna/i,
    groups: [
      {
        id: "size",
        label: "Porsiyon",
        required: true,
        multi: false,
        choices: [
          { id: "regular", label: "Standart" },
          { id: "large", label: "Büyük" },
        ],
      },
      {
        id: "extras",
        label: "Ekstralar",
        required: false,
        multi: true,
        choices: [
          { id: "cheese", label: "Ekstra peynir" },
          { id: "sauce", label: "Ekstra sos" },
          { id: "fries", label: "Patates" },
        ],
      },
    ],
  },
  {
    match: /kahve|latte|americano/i,
    groups: [
      {
        id: "size",
        label: "Boy",
        required: true,
        multi: false,
        choices: [
          { id: "s", label: "Küçük" },
          { id: "m", label: "Orta" },
          { id: "l", label: "Büyük" },
        ],
      },
      {
        id: "milk",
        label: "Süt tercihi",
        required: false,
        multi: false,
        choices: [
          { id: "regular", label: "Normal süt" },
          { id: "oat", label: "Yulaf sütü" },
          { id: "lactose_free", label: "Laktozsuz" },
        ],
      },
    ],
  },
];

export function getMockOptionGroups(productName: string): QrOptionGroup[] {
  for (const template of TEMPLATES) {
    if (template.match.test(productName)) {
      return template.groups;
    }
  }
  return [];
}

export function defaultSelectedOptions(groups: QrOptionGroup[]): Record<string, string[]> {
  const selected: Record<string, string[]> = {};
  for (const group of groups) {
    if (group.required && !group.multi && group.choices[0]) {
      selected[group.id] = [group.choices[0].id];
    } else {
      selected[group.id] = [];
    }
  }
  return selected;
}
