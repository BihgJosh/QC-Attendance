"use client";

import { useEffect } from "react";

const SCRIPT_ID = "qcu-emergency-alerts";

export function EmergencyAlertLoader() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "/qc-suite-assets/emergency-notify.js";
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  return null;
}
