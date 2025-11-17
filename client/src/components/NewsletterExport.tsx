import { useState } from "react";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { Download } from "lucide-react";

export function NewsletterExport() {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const utils = trpc.useUtils();

  const handleExport = async () => {
    try {
      setExporting(true);
      setMessage("");
      
      const result = await utils.newsletter.exportList.fetch();
      
      if (result.subscribers.length === 0) {
        setMessage("Keine Newsletter-Abonnenten vorhanden.");
        setExporting(false);
        return;
      }
      
      // Create CSV content
      const csvHeader = "Email,Abonniert am,Status\n";
      const csvRows = result.subscribers.map((sub: any) => {
        const date = new Date(sub.subscribedAt).toLocaleDateString("de-CH");
        const status = sub.isActive ? "Aktiv" : "Inaktiv";
        return `${sub.email},${date},${status}`;
      }).join("\n");
      
      const csvContent = csvHeader + csvRows;
      
      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `newsletter-abonnenten-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setMessage(`${result.subscribers.length} Abonnenten exportiert!`);
    } catch (error) {
      setMessage(`Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`);
    } finally {
      setExporting(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  return (
    <div>
      {message && (
        <div className="mb-3 p-2 bg-blue-900/30 border border-blue-700 rounded text-blue-400 text-sm">
          {message}
        </div>
      )}
      <Button
        onClick={handleExport}
        disabled={exporting}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        <Download className="w-4 h-4 mr-2" />
        {exporting ? "Exportiere..." : "Als CSV exportieren"}
      </Button>
    </div>
  );
}

