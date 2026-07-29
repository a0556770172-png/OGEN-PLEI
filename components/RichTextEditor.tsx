"use client";
import { useRef } from "react";
import { Bold, Italic, List, ListOrdered, Link2, Heading2, Underline } from "lucide-react";

export default function RichTextEditor({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? "");
  }

  function addLink() {
    const url = window.prompt("קישור (URL):");
    if (url) exec("createLink", url);
  }

  const tools = [
    { icon: Bold, cmd: "bold", title: "מודגש" },
    { icon: Italic, cmd: "italic", title: "נטוי" },
    { icon: Underline, cmd: "underline", title: "קו תחתון" },
    { icon: Heading2, cmd: "formatBlock", arg: "H2", title: "כותרת" },
    { icon: List, cmd: "insertUnorderedList", title: "רשימה" },
    { icon: ListOrdered, cmd: "insertOrderedList", title: "רשימה ממוספרת" }
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface2">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface p-2">
        {tools.map((t) => (
          <button
            key={t.cmd}
            type="button"
            title={t.title}
            onClick={() => exec(t.cmd, t.arg)}
            className="rounded-lg p-2 text-gray-300 transition hover:bg-primary/20 hover:text-white"
          >
            <t.icon className="h-4 w-4" />
          </button>
        ))}
        <button
          type="button"
          title="הוסף קישור"
          onClick={addLink}
          className="rounded-lg p-2 text-gray-300 transition hover:bg-primary/20 hover:text-white"
        >
          <Link2 className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dir="rtl"
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        data-placeholder={placeholder}
        style={{ direction: "rtl", textAlign: "right", unicodeBidi: "isolate" }}
        className="rich-content min-h-[180px] px-4 py-3 text-sm text-gray-100 outline-none empty:before:text-gray-500 empty:before:content-[attr(data-placeholder)]"
        dangerouslySetInnerHTML={{ __html: value }}
      />
    </div>
  );
}
