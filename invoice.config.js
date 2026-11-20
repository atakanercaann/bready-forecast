/* The invoice reader: the one file to make your own.

   FIELDS is what is read off every invoice and shown on every row. The page,
   the reader and the CSV export all follow this list, and the values are kept
   in one JSON column, so adding a field here needs no database change.

   Each field:
     key     stored on every invoice; lowercase, never renamed once in use
     label   what the page shows
     type    text | date | money | currency | choice
     ask     what the AI reader is told to look for. Be specific: this sentence
             is the whole of its instructions for the field.
     options for a choice: the allowed answers, in the order shown

   The keys supplier, invoice_no, date, total and currency have a meaning
   beyond their label: the duplicate finder, the totals and the free text
   reader use them. Keep them. */

export const FIELDS = [
  { key: "supplier", label: "Supplier", type: "text",
    ask: "the business that issued the invoice, the seller, as printed in its header or logo. Never the customer it is billed or shipped to." },
  { key: "invoice_no", label: "Invoice no.", type: "text",
    ask: "the invoice number exactly as printed, without the words Invoice or No." },
  { key: "date", label: "Invoice date", type: "date",
    ask: "the date the invoice was issued, as YYYY-MM-DD. Not the due date, not the delivery date." },
  { key: "due", label: "Due date", type: "date",
    ask: "the date payment is due, as YYYY-MM-DD, only if it is printed. For terms like Net 30 without a date, leave it empty." },
  { key: "total", label: "Total", type: "money",
    ask: "the grand total of the invoice including tax, as digits with one dot for cents and no symbol or thousands separator, e.g. 1356.40. Not a subtotal, not an amount already paid, not a balance of 0." },
  { key: "tax", label: "Tax", type: "money",
    ask: "the total tax charged (GST, HST, PST, QST, VAT or sales tax added together), as digits with one dot, e.g. 64.59. Empty if no tax is shown." },
  { key: "currency", label: "Currency", type: "currency",
    ask: "the three-letter currency code of the total, e.g. CAD, USD, EUR. If only $ is printed, use the supplier's country." },
  { key: "category", label: "Category", type: "choice",
    options: ["Produce", "Meat & seafood", "Dairy & eggs", "Bakery", "Dry goods", "Beverages", "Alcohol",
              "Packaging", "Cleaning & paper", "Equipment & repairs", "Rent & utilities", "Services", "Other"],
    ask: "which one of the allowed categories most of this invoice's money went on." },
];

/* What a paid invoice is called, what a new one starts as. The key "paid"
   matters to the database: a paid invoice can only be changed by someone
   with Full on the invoices (see database/invoices.sql). */
export const STATUSES = [
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "disputed", label: "Disputed" },
];
export const DEFAULT_STATUS = "unpaid";
export const DEFAULT_CURRENCY = "CAD";

/* Your own business, as it appears on the invoices you receive: its name, and
   its web or email domain. The reader must never take the Bill To line, which
   is you, for the supplier. */
export const OWN_NAMES = ["Bready", "Bready Cafe", "Bready Café", "Bready Bakery", "breadycafe.com"];

/* Which reader goes first. "parser" is the free one in the browser: it reads
   the text of a PDF and is instant, but it finds only what its patterns know
   and cannot read a photo. "ai" is the reading server: it reads photos and any
   layout, for a fraction of a cent an invoice. Whatever the first leaves
   empty, the second fills. ["ai"] alone, or ["parser"] alone, also work. */
export const READ_ORDER = ["parser", "ai"];

/* The area on the Team & access page that governs the invoices, if that kit
   is installed. Without it, every signed-in account can do everything. */
export const AREA = "invoices";
