/** Converts a Google Docs/Sheets/Slides URL into an embeddable URL. Returns null if not a Google doc link. */
export function getGoogleEmbedUrl(url: string): { embedUrl: string; type: string } | null {
  try {
    const u = new URL(url.trim());
    if (!u.hostname.endsWith("google.com")) return null;

    // Google Docs
    const docsMatch = u.pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    if (docsMatch) {
      return { embedUrl: `https://docs.google.com/document/d/${docsMatch[1]}/preview`, type: "Google Docs" };
    }

    // Google Sheets
    const sheetsMatch = u.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (sheetsMatch) {
      return { embedUrl: `https://docs.google.com/spreadsheets/d/${sheetsMatch[1]}/preview`, type: "Google Sheets" };
    }

    // Google Slides
    const slidesMatch = u.pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
    if (slidesMatch) {
      return { embedUrl: `https://docs.google.com/presentation/d/${slidesMatch[1]}/embed?start=false&loop=false&delayms=3000`, type: "Google Slides" };
    }

    // Google Forms
    const formsMatch = u.pathname.match(/\/forms\/d\/e\/([a-zA-Z0-9_-]+)/);
    if (formsMatch) {
      return { embedUrl: `https://docs.google.com/forms/d/e/${formsMatch[1]}/viewform?embedded=true`, type: "Google Forms" };
    }

    return null;
  } catch {
    return null;
  }
}
