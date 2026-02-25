import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

type CopyMarkdownButtonProps = {
  markdownPath: string;
  labels?: {
    copy?: string;
    copied?: string;
    failed?: string;
  };
};

type CopyState = "idle" | "copying" | "copied" | "failed";

export function CopyMarkdownButton({ markdownPath, labels }: CopyMarkdownButtonProps): JSX.Element {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimerRef = useRef<number | null>(null);

  const copyLabel = labels?.copy ?? "Copy Markdown";
  const copiedLabel = labels?.copied ?? "Copied";
  const failedLabel = labels?.failed ?? "Copy failed";

  useEffect(() => {
    setCopyState("idle");

    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, [markdownPath]);

  const scheduleReset = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopyState("idle");
      resetTimerRef.current = null;
    }, 1800);
  };

  const onCopy = async () => {
    try {
      setCopyState("copying");
      const response = await fetch(markdownPath, {
        headers: {
          Accept: "text/markdown",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch markdown: ${response.status}`);
      }

      const markdown = await response.text();
      await navigator.clipboard.writeText(markdown);
      setCopyState("copied");
      scheduleReset();
    } catch {
      setCopyState("failed");
      scheduleReset();
    }
  };

  const label =
    copyState === "copied" ? copiedLabel : copyState === "failed" ? failedLabel : copyLabel;

  return (
    <div className="mb-4 flex justify-end">
      <button
        type="button"
        onClick={() => void onCopy()}
        disabled={copyState === "copying"}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-70 dark:hover:bg-white/5"
        aria-live="polite"
      >
        {copyState === "copying" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : copyState === "copied" ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        <span>{label}</span>
      </button>
    </div>
  );
}
