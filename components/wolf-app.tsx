"use client";
import { useState } from "react";
import PrototypeWolfApp from "@/components/prototype-wolf-app";
import OnlineWolfApp from "@/components/online-wolf-app";
import type { Screen } from "@/types/game";

export default function WolfApp({ initialScreen }: { initialScreen: Screen }) {
  const [demo, setDemo] = useState(false);
  return demo ? (
    <>
      <div className="demo-banner" role="status">
        BẢN MÔ PHỎNG · Các nhân vật mẫu không phải người chơi online
        <button
          onClick={() => {
            history.replaceState(null, "", "/");
            setDemo(false);
          }}
        >
          Trở về phòng online
        </button>
      </div>
      <PrototypeWolfApp initialScreen="home" />
    </>
  ) : (
    <OnlineWolfApp initialScreen={initialScreen} onDemo={() => setDemo(true)} />
  );
}
