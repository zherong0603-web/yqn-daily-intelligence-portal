// This helper only parses bounded PDF bytes supplied on stdin. It never fetches a URL.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

globalThis.fetch = async () => { throw new Error("PDF extraction must not access the network"); };

try {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > 3_000_000) throw new Error("PDF input exceeds limit");
    chunks.push(chunk);
  }
  const task = getDocument({
    data: new Uint8Array(Buffer.concat(chunks)),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    verbosity: 0,
  });
  const pdf = await task.promise;
  if (pdf.numPages > 200) throw new Error("PDF page count exceeds limit");
  let text = "";
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text += content.items.map((item) => "str" in item ? item.str : "").join(" ") + "\n";
    if (Buffer.byteLength(text, "utf8") > 2_900_000) throw new Error("PDF text exceeds limit");
    page.cleanup();
  }
  await task.destroy();
  if (!text.trim()) throw new Error("PDF has no extractable text");
  process.stdout.write(text);
} catch {
  process.stderr.write("PDF extraction failed\n");
  process.exitCode = 1;
}
