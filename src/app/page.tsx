"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("@/game/Game"), {
  ssr: false,
  loading: () => <main className="loading-screen"><span className="eyebrow">TOKYO MIDNIGHT 86</span><h1>Warming up.</h1><p>ドライビングラボを準備しています…</p></main>,
});

export default function Home() { return <Game />; }
