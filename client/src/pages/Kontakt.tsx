import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mail, MessageSquare, HelpCircle } from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Kontakt() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notifyOwnerMutation = trpc.system.notifyOwner.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject || !message) {
      toast.error('Bitte füllen Sie alle Felder aus');
      return;
    }

    setIsSubmitting(true);

    try {
      await notifyOwnerMutation.mutateAsync({
        title: `Kontaktanfrage: ${subject}`,
        content: `Von: ${user?.name || user?.email || 'Unbekannt'}\n\nBetreff: ${subject}\n\nNachricht:\n${message}`,
      });

      toast.success('Nachricht gesendet', {
        description: 'Wir werden uns so schnell wie möglich bei Ihnen melden.',
      });

      setSubject('');
      setMessage('');
    } catch (error) {
      toast.error('Fehler beim Senden', {
        description: 'Bitte versuchen Sie es später erneut.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kontakt</h1>
          <p className="text-muted-foreground">
            Haben Sie Fragen oder Feedback? Kontaktieren Sie uns!
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Contact Form */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Nachricht senden
              </CardTitle>
              <CardDescription>
                Füllen Sie das Formular aus und wir melden uns bei Ihnen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={user?.email || ''} 
                    disabled
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subject">Betreff</Label>
                  <Input 
                    id="subject" 
                    placeholder="Worum geht es?"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message">Nachricht</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Ihre Nachricht..."
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Wird gesendet...' : 'Nachricht senden'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* FAQ and Support Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Häufige Fragen
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1">Wie erstelle ich ein Portfolio?</h4>
                  <p className="text-sm text-muted-foreground">
                    Gehen Sie zu "Portfolio Optimizer" und wählen Sie Ihre gewünschten Aktien aus.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Was ist Live-Tracking?</h4>
                  <p className="text-sm text-muted-foreground">
                    Live-Tracking ermöglicht es Ihnen, die Performance Ihres Portfolios in Echtzeit zu verfolgen.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Wie kann ich mein Portfolio exportieren?</h4>
                  <p className="text-sm text-muted-foreground">
                    Gehen Sie zu "Einstellungen" und nutzen Sie die Export-Funktion.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Support
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Unser Support-Team steht Ihnen gerne zur Verfügung. 
                  Antwortzeit: Innerhalb von 24 Stunden.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
