import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="sheet" style={{ textAlign: "center" }}>
      <p className="wordmark">Orario</p>
      <h1 className="display" style={{ marginTop: "2rem" }}>
        Esta página não existe
      </h1>
      <p className="lead" lang="en">
        This page doesn&apos;t exist.
      </p>
      <p style={{ marginTop: "2rem" }}>
        <Link href="/" className="button">
          Orario
        </Link>
      </p>
    </main>
  );
}
