import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <section className="flex flex-col items-center justify-center py-16">
      <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-6">
        Willkommen bei BYNDL
      </h1>
      <p className="text-lg sm:text-xl text-center max-w-2xl mb-8">
        Mit BYNDL können Sie in wenigen Schritten ein professionelles,
        VOB‑konformes Leistungsverzeichnis (LV) inklusive realistischer
        Kostenschätzung erstellen – auch ohne Fachwissen. Starten Sie Ihr
        Projekt und beantworten Sie einen intelligenten Fragenkatalog, der auf
        Ihr Vorhaben zugeschnitten ist.
      </p>
      <Link
        to="/start"
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded shadow"
      >
        Projekt starten
      </Link>
    </section>
  );
}