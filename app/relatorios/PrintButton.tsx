'use client';

export default function PrintButton() {
  return <button className="btn success" type="button" onClick={() => window.print()}>Imprimir / salvar PDF</button>;
}
