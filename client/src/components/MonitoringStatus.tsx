/**
 * MonitoringStatus Component
 * Shows the status of scheduled Copilot jobs:
 * - Walk-Forward Weekly
 * - LPPL Daily Monitoring
 * - Recommendation Evaluation
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Globe, 
  Flame, 
  BarChart3,
  Bell,
  BellRing,
  Shield,
} from 'lucide-react';

interface ScheduledJob {
  name: string;
  description: string;
  schedule: string;
  icon: React.ReactNode;
  status: 'active' | 'pending_deploy';
}

const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: 'Walk-Forward Validation',
    description: 'Wöchentliche Walk-Forward Analyse auf dem Watchlist-Universum (100 Titel). Benachrichtigung bei Top-Titeln mit konsistentem Alpha.',
    schedule: 'Jeden Sonntag, 03:00 UTC',
    icon: <Globe className="h-5 w-5 text-blue-400" />,
    status: 'pending_deploy',
  },
  {
    name: 'LPPL Bubble-Monitoring',
    description: 'Tägliche LPPL-Analyse auf allen Portfolio-Positionen. Automatische Warnung bei Bubble-Signalen (Confidence > 70%).',
    schedule: 'Täglich, 06:00 UTC',
    icon: <Flame className="h-5 w-5 text-orange-400" />,
    status: 'pending_deploy',
  },
  {
    name: 'Empfehlungs-Evaluation',
    description: 'Tägliche Überprüfung vergangener Copilot-Empfehlungen. Misst Trefferquote nach 30/60/90 Tagen.',
    schedule: 'Täglich, 07:00 UTC',
    icon: <BarChart3 className="h-5 w-5 text-emerald-400" />,
    status: 'pending_deploy',
  },
];

export default function MonitoringStatus() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Automatisches Monitoring
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Scheduled Jobs für kontinuierliche Portfolio-Überwachung
          </p>
        </div>
        <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
          <Clock className="h-3 w-3 mr-1" />
          Aktivierung nach Deploy
        </Badge>
      </div>

      {/* Job Cards */}
      <div className="grid gap-3">
        {SCHEDULED_JOBS.map((job) => (
          <Card key={job.name} className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{job.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white">{job.name}</h4>
                    <Badge 
                      variant="outline" 
                      className={job.status === 'active' 
                        ? 'border-emerald-500/50 text-emerald-400' 
                        : 'border-gray-600 text-gray-400'
                      }
                    >
                      {job.status === 'active' ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Aktiv</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1" /> Bereit</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{job.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Calendar className="h-3.5 w-3.5 text-gray-500" />
                    <span className="text-xs text-gray-500">{job.schedule}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notification Info */}
      <Card className="bg-gray-800/30 border-gray-700/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <BellRing className="h-5 w-5 text-cyan-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-white">Benachrichtigungen</h4>
              <p className="text-sm text-gray-400 mt-1">
                Bei wichtigen Signalen erhältst du automatische Benachrichtigungen:
              </p>
              <ul className="text-sm text-gray-400 mt-2 space-y-1">
                <li className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-blue-400" />
                  Walk-Forward: Top-Titel mit OOS-Alpha &gt; 0 und Hit Rate &gt; 55%
                </li>
                <li className="flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  LPPL: Bubble-Warnung bei Confidence &gt; 70% in deinen Positionen
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  Empfehlungen: Wöchentliche Zusammenfassung der Trefferquote
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Save Info */}
      <Card className="bg-emerald-900/20 border-emerald-700/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5" />
            <div>
              <h4 className="font-medium text-emerald-300">Auto-Save aktiv</h4>
              <p className="text-sm text-gray-400 mt-1">
                Jede Copilot-Analyse speichert automatisch alle Empfehlungen in der Historie. 
                So wird die Trefferquote über Zeit messbar und der Algorithmus validierbar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
