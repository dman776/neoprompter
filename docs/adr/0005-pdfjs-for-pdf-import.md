# pdfjs-dist reads PDFs on Import, text only

Import accepts `.pdf` by extracting text with `pdfjs-dist` (legacy build, in the main process). A hand-written reader like the `.doc` one is impractical for PDF. It is the heaviest dependency we ship, so it is hard to drop once Operators rely on it. Only text comes in: no headings, emphasis or color, because PDF carries no reliable structure to read them from. Lines are rejoined into paragraphs by vertical gap. Scanned (image-only) and password-protected PDFs are refused with a message; OCR was rejected as too large for the benefit.
