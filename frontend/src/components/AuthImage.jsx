import { useEffect, useRef, useState } from "react";
import api from "../api";

// API arkasındaki görseller Bearer token gerektirdiği için doğrudan <img src> ile
// yüklenemez. Bu bileşen görseli blob olarak çeker, object URL üretir ve unmount'ta
// serbest bırakır. onClick verilirse tıklanınca tam boyut yeni sekmede açılır.
export default function AuthImage({ src, alt = "", className = "", openable = true }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  const urlRef = useRef(null);

  useEffect(() => {
    let active = true;
    api
      .get(src, { responseType: "blob" })
      .then((res) => {
        if (!active) return;
        const objUrl = URL.createObjectURL(res.data);
        urlRef.current = objUrl;
        setUrl(objUrl);
      })
      .catch(() => active && setErr(true));
    return () => {
      active = false;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [src]);

  if (err) {
    return (
      <div className={`flex items-center justify-center bg-slate-200/60 dark:bg-white/5 text-slate-400 text-xs ${className}`}>
        ⚠️
      </div>
    );
  }
  if (!url) {
    return <div className={`bg-slate-200/60 dark:bg-white/5 animate-pulse ${className}`} />;
  }
  return (
    <img
      src={url}
      alt={alt}
      onClick={openable ? () => window.open(url, "_blank") : undefined}
      className={`${className} ${openable ? "cursor-zoom-in" : ""}`}
    />
  );
}
