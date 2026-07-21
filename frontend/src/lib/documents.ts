/**
 * Catalog of the documents the agent is grounded in.
 *
 * This mirrors `app/docs/*.md` on the backend. It is display metadata only:
 * the UI never answers from it. It is used to give a citation a human title,
 * to resolve "§ 2" into the real section heading, and to tell the shopkeeper
 * up front what the assistant does and does not know about.
 */

export type DocKind = "contract" | "handbook" | "policy" | "tax";

export interface KnowledgeDoc {
  /** Filename as it appears in citations, e.g. supplier_contract_unga_millers.md */
  id: string;
  /** Short label for chips. */
  label: string;
  /** Full document title (the H1 in the markdown file). */
  title: string;
  kind: DocKind;
  blurb: string;
  /** Section headings, in order, as they appear in the file. */
  sections: string[];
  /** Extra phrases the model might use to name this document in prose. */
  aliases: string[];
}

export const KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    id: "supplier_contract_unga_millers.md",
    label: "Unga Millers contract",
    title: "Supplier Agreement: Unga Millers Ltd",
    kind: "contract",
    blurb: "Flour supply terms: payment, returns, minimum order, delivery.",
    sections: [
      "1. Payment Terms",
      "2. Returns and Damaged Stock",
      "3. Minimum Order and Pricing",
      "4. Delivery",
      "5. Termination",
    ],
    aliases: ["unga millers", "unga millers ltd", "unga contract", "supplier agreement unga"],
  },
  {
    id: "supplier_contract_coastal_beverages.md",
    label: "Coastal Beverages contract",
    title: "Supplier Agreement: Coastal Beverages Distributors",
    kind: "contract",
    blurb: "Drinks supply terms: payment, returns, minimum order, delivery.",
    sections: [
      "1. Payment Terms",
      "2. Returns and Damaged Stock",
      "3. Minimum Order and Pricing",
      "4. Delivery",
      "5. Termination",
    ],
    aliases: [
      "coastal beverages",
      "coastal beverages distributors",
      "coastal contract",
      "beverages contract",
    ],
  },
  {
    id: "staff_handbook_supplier_returns.md",
    label: "Staff handbook",
    title: "Staff Handbook, Section 4: Handling Supplier Deliveries and Returns",
    kind: "handbook",
    blurb: "What staff should do on deliveries, damages, driver payments, expiry.",
    sections: [
      "4.1 Receiving a delivery",
      "4.2 Damaged or torn stock",
      "4.3 Paying delivery drivers",
      "4.4 Expired stock",
      "4.5 Who to contact",
    ],
    aliases: ["staff handbook", "handbook", "employee handbook", "kitabu cha wafanyakazi"],
  },
  {
    id: "pricing_and_discount_policy.md",
    label: "Pricing and discounts",
    title: "Pricing and Customer Discount Policy",
    kind: "policy",
    blurb: "Customer tiers, stacking rules, rounding, manager overrides, promos.",
    sections: [
      "1. Customer tiers",
      "2. Stacking rules",
      "3. Rounding",
      "4. Manager override",
      "5. Promotional pricing",
    ],
    aliases: [
      "pricing policy",
      "discount policy",
      "pricing and customer discount policy",
      "sera ya bei",
    ],
  },
  {
    id: "kra_turnover_tax_guide.md",
    label: "KRA turnover tax",
    title: "KRA Turnover Tax (TOT) Guide for Small Retailers",
    kind: "tax",
    blurb: "Turnover tax basics, filing deadlines, records, penalties, exemptions.",
    sections: [
      "1. What Turnover Tax is",
      "2. Filing deadline",
      "3. Record keeping",
      "4. Penalties",
      "5. Exemptions",
    ],
    aliases: [
      "kra",
      "turnover tax",
      "tot guide",
      "kra turnover tax guide",
      "ushuru wa mauzo",
    ],
  },
];

const DOCS_BY_ID = new Map(KNOWLEDGE_DOCS.map((doc) => [doc.id.toLowerCase(), doc]));

export function findDoc(id: string | null | undefined): KnowledgeDoc | undefined {
  if (!id) return undefined;
  const key = id.toLowerCase().trim();
  const direct = DOCS_BY_ID.get(key);
  if (direct) return direct;
  // Citations sometimes arrive as a path, e.g. app/docs/foo.md
  const basename = key.split(/[\\/]/).pop() ?? key;
  return DOCS_BY_ID.get(basename);
}

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  contract: "Supplier contract",
  handbook: "Staff handbook",
  policy: "Internal policy",
  tax: "Tax guide",
};

export interface StarterPrompt {
  text: string;
  hint: string;
  /** Marks the prompt that shows off cross document conflict detection. */
  highlight?: boolean;
  lang?: "sw";
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    text: "How long do I have to report damaged stock?",
    hint: "Contract vs handbook",
    highlight: true,
  },
  {
    text: "Can I pay the delivery driver in cash?",
    hint: "Contract vs handbook",
    highlight: true,
  },
  {
    text: "A regular customer buys 25kg of rice. What discount?",
    hint: "Pricing policy",
  },
  {
    text: "Nilipe turnover tax lini?",
    hint: "KRA guide, Kiswahili",
    lang: "sw",
  },
  {
    text: "What is the minimum order for Coastal Beverages?",
    hint: "Coastal contract",
  },
  {
    text: "Je, naweza kurudisha mzigo ulioharibika?",
    hint: "Returns, Kiswahili",
    lang: "sw",
  },
];
