"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { createQuickNote } from "@/app/actions/notes";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "儲存中…" : "記下來"}
    </button>
  );
}

export default function QuickForm({
  defaultValue,
  afterSave,
}: {
  defaultValue?: string;
  /** 儲存後前往的頁面（例如從分享進來時回到速記列表） */
  afterSave?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await createQuickNote(fd);
        formRef.current?.reset();
        if (afterSave) router.push(afterSave);
      }}
      className="rounded-xl border border-stone-200 bg-surface p-3 focus-within:border-brand-500"
    >
      <textarea
        name="content"
        required
        rows={3}
        defaultValue={defaultValue}
        autoFocus
        placeholder="隨手記一下…（Ctrl/⌘ + Enter 送出）"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        className="w-full resize-y bg-transparent outline-none"
      />
      <div className="flex justify-end">
        <Submit />
      </div>
    </form>
  );
}
