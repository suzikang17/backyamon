"use client";

import { useEffect } from "react";

const FAREWELLS = [
  "Lickkle more! \u{1F30A}",
  "One love! \u{270C}\u{FE0F}",
  "Bless up! \u{1F64F}",
  "Inna di morrows! \u{2600}\u{FE0F}",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Farewell() {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      // Show a brief farewell — browser may or may not display custom text,
      // but we set it anyway for browsers that do
      e.returnValue = pick(FAREWELLS);
    };

    // Only attach when user is mid-game (has interacted)
    const attachOnInteraction = () => {
      window.addEventListener("beforeunload", handler);
      window.removeEventListener("click", attachOnInteraction);
    };

    window.addEventListener("click", attachOnInteraction);

    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("click", attachOnInteraction);
    };
  }, []);

  return null;
}
