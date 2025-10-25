import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Upload, FileText, Image as ImageIcon, File, Trash2, Download } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

interface ResearchButtonProps {
  onBackClick: () => void;
}

export default function Research({ onBackClick }: ResearchButtonProps) {
  const { isAuthenticated } = useAuth();
  const { data: researchItems = [], refetch } = trpc.research.list.useQuery();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const addResearchMutation = trpc.research.add.useMutation({
    onSuccess: () => {
      refetch();
      setTitle("");
      setContent("");
      setSelectedFile(null);
    },
  });

  const deleteResearchMutation = trpc.research.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!title) {
      alert("Bitte einen Titel eingeben");
      return;
    }

    let fileUrl = "";
    let fileType = "text";

    if (selectedFile) {
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        fileType = selectedFile.type.startsWith("image/") ? "image" : 
                   selectedFile.type.includes("pdf") ? "pdf" : "file";
        
        addResearchMutation.mutate({
          title,
          content,
          fileUrl: base64,
          fileType,
          fileName: selectedFile.name,
        } as any);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      addResearchMutation.mutate({
        title,
        content,
        fileUrl: "",
        fileType: "text",
        fileName: "",
      } as any);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Research & Dokumentation</h1>
            <p className="text-slate-300">Sammle und organisiere deine Investment-Research</p>
          </div>
          <Button onClick={onBackClick} variant="outline" className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
            Zurück
          </Button>
        </div>

        {isAuthenticated && (
          <Card className="bg-slate-800 border-slate-700 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Neuen Research-Eintrag hinzufügen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  placeholder="Titel (z.B. 'NVIDIA Q4 2024 Analyse')"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white"
                />
                <Textarea
                  placeholder="Inhalt / Notizen..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white min-h-32"
                />
                <div className="flex gap-4 items-center">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-700 border border-slate-600 rounded hover:bg-slate-600 transition-colors">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm">
                        {selectedFile ? selectedFile.name : "Datei hochladen (optional)"}
                      </span>
                    </div>
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    />
                  </label>
                  <Button onClick={handleSubmit} className="bg-indigo-600 hover:bg-indigo-700">
                    Hinzufügen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {researchItems.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center">
                <p className="text-slate-400">Noch keine Research-Einträge vorhanden.</p>
              </CardContent>
            </Card>
          ) : (
            researchItems.map((item: any) => (
              <Card key={item.id} className="bg-slate-800 border-slate-700 hover:border-indigo-500 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {item.fileType === "image" && <ImageIcon className="w-5 h-5 text-indigo-400" />}
                        {item.fileType === "pdf" && <FileText className="w-5 h-5 text-red-400" />}
                        {item.fileType === "file" && <File className="w-5 h-5 text-blue-400" />}
                        {item.fileType === "text" && <FileText className="w-5 h-5 text-slate-400" />}
                        <h3 className="text-xl font-bold text-white">{item.title}</h3>
                      </div>
                      {item.content && (
                        <p className="text-slate-300 mb-3 whitespace-pre-wrap">{item.content}</p>
                      )}
                      {item.fileUrl && item.fileType === "image" && (
                        <img src={item.fileUrl} alt={item.title} className="max-w-md rounded border border-slate-700 mb-3" />
                      )}
                      {item.fileName && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Download className="w-4 h-4" />
                          <a href={item.fileUrl} download={item.fileName} className="hover:text-indigo-400 transition-colors">
                            {item.fileName}
                          </a>
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-2">
                        {new Date(item.createdAt).toLocaleDateString('de-DE', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {isAuthenticated && (
                      <Button
                        onClick={() => deleteResearchMutation.mutate(item.id)}
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
