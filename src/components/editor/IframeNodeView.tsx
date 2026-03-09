import { NodeViewWrapper } from "@tiptap/react";
import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, ExternalLink } from "lucide-react";

function extractTitle(src: string, title?: string): string {
  if (title && title !== "null") return title;
  try {
    const url = new URL(src);
    if (url.hostname.includes("google.com")) {
      if (src.includes("/document/")) return "Google Docs";
      if (src.includes("/spreadsheets/")) return "Google Sheets";
      if (src.includes("/presentation/")) return "Google Slides";
      if (src.includes("/forms/")) return "Google Forms";
    }
    return url.hostname;
  } catch {
    return "Documento embedado";
  }
}

function getOriginalUrl(src: string): string {
  try {
    // Convert embed/preview/edit URLs back to regular URLs
    return src
      .replace("/preview", "/edit")
      .replace("/edit?embedded=true", "/edit")
      .replace("/embed?start=false&loop=false&delayms=3000", "/edit")
      .replace("/viewform?embedded=true", "/viewform");
  } catch {
    return src;
  }
}

export function IframeNodeView({ node, updateAttributes }: any) {
  const { src, title, allowfullscreen, collapsed } = node.attrs;
  const [isCollapsed, setIsCollapsed] = useState(collapsed === true || collapsed === "true");

  const displayTitle = extractTitle(src, title);
  const originalUrl = getOriginalUrl(src);

  const handleToggle = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    updateAttributes({ collapsed: next });
  };

  return (
    <NodeViewWrapper className="iframe-embed my-3" data-drag-handle>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        {/* Header - always visible */}
        <div
          className="flex items-center gap-2 px-3 py-2 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors select-none"
          onClick={handleToggle}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate flex-1">{displayTitle}</span>
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title="Abrir em nova aba"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {/* Iframe - collapsible */}
        {!isCollapsed && (
          <iframe
            src={src}
            title={displayTitle}
            frameBorder="0"
            allowFullScreen={allowfullscreen}
            style={{
              width: "100%",
              height: "500px",
              display: "block",
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}
