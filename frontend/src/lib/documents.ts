/**
 * Catalog of the documents the agent is grounded in.
 *
 * This mirrors `app/docs/*.md` on the backend. It is display metadata only:
 * the UI never answers from it. It is used to give a citation a human title,
 * to resolve "§ 2" into the real section heading, and to tell the shopkeeper
 * up front what the assistant does and does not know about.
 */

export type DocKind = "contract" | "handbook" | "policy" | "tax" | "access";

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
    id: "staff_handbook.md",
    label: "Staff handbook",
    title: "Staff Handbook — Baraka General Store",
    kind: "handbook",
    blurb: "Hours, customer service, till procedure, deliveries, safety, escalation.",
    sections: [
      "1. Welcome and Shop Hours",
      "2. Customer Service Standards",
      "3. Cash Handling and Till Procedure",
      "4. Handling Supplier Deliveries and Returns",
      "4.1 Receiving a delivery",
      "4.2 Damaged or torn stock",
      "4.3 Paying delivery drivers",
      "4.4 Expired stock",
      "5. Health and Safety",
      "6. Who to Contact",
    ],
    aliases: ["staff handbook", "handbook", "employee handbook", "kitabu cha wafanyakazi"],
  },
  {
    id: "employee_roles_and_access_policy.md",
    label: "Roles and access policy",
    title: "Employee Roles and Access Policy — Baraka General Store",
    kind: "access",
    blurb: "Who may authorize what, and what each role may ask Duka Akili.",
    sections: [
      "1. Roles",
      "2. Discount Authorization Limits",
      "3. What Each Role May Ask Duka Akili",
      "4. Escalation",
      "5. Audit",
    ],
    aliases: [
      "roles and access policy",
      "employee roles",
      "access policy",
      "roles policy",
      "sera ya majukumu",
    ],
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

/**
 * Documents uploaded at runtime, which are not in the static catalog above.
 *
 * Without this, a citation to an uploaded document fails to resolve and is
 * silently dropped, and the answer can end up credited to whichever catalog
 * document happens to share a word with the prose. That is not hypothetical:
 * an answer built entirely from an uploaded M-Pesa policy was attributed to
 * the KRA tax guide, because the phrase "turnover tax" appeared in it.
 */
const LIVE_DOCS = new Map<string, KnowledgeDoc>();

export function registerLiveDocuments(
  docs: { document: string; title: string; sections: string[] }[],
): void {
  for (const doc of docs) {
    const key = doc.document.toLowerCase();
    if (DOCS_BY_ID.has(key)) continue; // the static entry is richer, keep it
    LIVE_DOCS.set(key, {
      id: doc.document,
      label: doc.title,
      title: doc.title,
      kind: "policy",
      blurb: "",
      sections: doc.sections,
      // No aliases. Guessing prose names for an unknown document is exactly
      // what caused the misattribution described above.
      aliases: [],
    });
  }
}

export function findDoc(id: string | null | undefined): KnowledgeDoc | undefined {
  if (!id) return undefined;
  const key = id.toLowerCase().trim();
  const direct = DOCS_BY_ID.get(key) ?? LIVE_DOCS.get(key);
  if (direct) return direct;
  // Citations sometimes arrive as a path, e.g. app/docs/foo.md
  const basename = key.split(/[\\/]/).pop() ?? key;
  return DOCS_BY_ID.get(basename) ?? LIVE_DOCS.get(basename);
}

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  contract: "Supplier contract",
  handbook: "Staff handbook",
  policy: "Internal policy",
  tax: "Tax guide",
  access: "Roles and access",
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
    // Naming the supplier is deliberate. Tested live: the generic phrasing
    // "How long do I have to report damaged stock?" sometimes retrieves only
    // 2 of the 3 relevant documents (retrieval is similarity based, not
    // exhaustive), which can miss the real conflict this prompt exists to
    // demonstrate. Naming Unga Millers reliably pulls in both the contract
    // (48 hours) and the staff handbook (7 days).
    text: "How long do I have to report damaged stock from Unga Millers?",
    hint: "Contract vs handbook",
    highlight: true,
  },
  {
    text: "Can I pay the Unga Millers delivery driver in cash?",
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
