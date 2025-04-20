import { type ReactNode, useEffect } from "react";

export default function Home(): ReactNode {
  useEffect(() => {
    window.location.replace("/docs/CCC");
  }, []);
}
