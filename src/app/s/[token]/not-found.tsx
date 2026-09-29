export default function SharedNoteNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="text-4xl">🔗</div>
      <h1 className="mt-3 text-xl font-bold">這個分享連結已經失效</h1>
      <p className="mt-2 text-sm text-stone-500">可能是對方停止分享、換了新連結，或連結已經過期。</p>
    </div>
  );
}
