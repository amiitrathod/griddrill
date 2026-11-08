import Link from "next/link";
export function UpgradeNotice({ moduleTitle }: { moduleTitle: string }) {
  return (
    <div className="mx-auto w-full max-w-content px-4 py-8">
      <div className="card p-6 max-w-prose">
        <h1 style={{ fontSize: "1.5rem" }}>{moduleTitle} is part of Pro</h1>
        <p className="mt-2">Modules 1 to 3 and the shortcut trainer stay free. Pro opens every module, all job tests and the certificate.</p>
        <div className="mt-4 flex gap-2">
          <Link href="/pricing" className="btn-primary">See Pro</Link>
          <Link href="/lessons" className="btn-secondary">Back to free lessons</Link>
        </div>
      </div>
    </div>
  );
}
