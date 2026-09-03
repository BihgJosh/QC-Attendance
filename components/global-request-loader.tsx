"use client";

import { useEffect, useRef, useState } from "react";

import { BrandedLoader } from "@/components/ui/branded-loader";

const SHOW_DELAY_MS = 220;
const MIN_VISIBLE_MS = 360;

export function GlobalRequestLoader() {
  const [visible, setVisible] = useState(false);
  const pending = useRef(0);
  const isVisible = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = useRef(0);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const begin = () => {
      pending.current += 1;
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (pending.current !== 1 || showTimer.current || isVisible.current) return;
      showTimer.current = setTimeout(() => {
        showTimer.current = null;
        if (pending.current > 0) {
          shownAt.current = Date.now();
          isVisible.current = true;
          setVisible(true);
        }
      }, SHOW_DELAY_MS);
    };

    const end = () => {
      pending.current = Math.max(0, pending.current - 1);
      if (pending.current > 0) return;
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
      hideTimer.current = setTimeout(() => {
        isVisible.current = false;
        setVisible(false);
      }, remaining);
    };

    window.fetch = async (...args) => {
      begin();
      try {
        return await originalFetch(...args);
      } finally {
        end();
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (showTimer.current) clearTimeout(showTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="qc-request-loader" role="dialog" aria-modal="true" aria-label="Request in progress">
      <div className="qc-request-loader__backdrop" />
      <div className="qc-request-loader__card">
        <BrandedLoader />
      </div>
    </div>
  );
}
