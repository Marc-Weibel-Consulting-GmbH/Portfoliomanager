/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Zirkulaere Abhaengigkeiten erschweren das Zerlegen der God-Files (Audit C-3).",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-client-to-server",
      severity: "error",
      comment: "Schichtentrennung: client darf nicht aus server importieren.",
      from: { path: "^client" },
      to: { path: "^server" },
    },
    {
      name: "no-server-to-client",
      severity: "error",
      comment: "Schichtentrennung: server darf nicht aus client importieren.",
      from: { path: "^server" },
      to: { path: "^client" },
    },
    {
      name: "no-orphans",
      severity: "info",
      comment:
        "Verwaiste Module — Kandidaten fuer die Skript-/Dead-Code-Bereinigung.",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
          "\\.d\\.ts$",
          "\\.test\\.ts$",
          "\\.spec\\.ts$",
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: "node_modules|dist|vendor|mcp-servers|design|drizzle/meta|analytics_service|tradingview-service",
    },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/(@[^/]+/[^/]+|[^/]+)" },
      text: { highlightFocused: true },
    },
  },
};
