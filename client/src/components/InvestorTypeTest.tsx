import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface InvestorTypeTestProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (type: "conservative" | "balanced" | "dynamic") => void;
}

interface Question {
  id: number;
  question: string;
  options: {
    text: string;
    score: number; // conservative=1, balanced=2, dynamic=3
  }[];
}

const questions: Question[] = [
  {
    id: 1,
    question: "Wie lange planen Sie, Ihr Geld anzulegen?",
    options: [
      { text: "Weniger als 3 Jahre", score: 1 },
      { text: "3-7 Jahre", score: 2 },
      { text: "Mehr als 7 Jahre", score: 3 },
    ],
  },
  {
    id: 2,
    question: "Wie würden Sie auf einen Verlust von 20% in Ihrem Portfolio reagieren?",
    options: [
      { text: "Ich würde sofort verkaufen, um weitere Verluste zu vermeiden", score: 1 },
      { text: "Ich würde abwarten und nichts tun", score: 2 },
      { text: "Ich würde nachkaufen, um vom niedrigen Kurs zu profitieren", score: 3 },
    ],
  },
  {
    id: 3,
    question: "Was ist Ihr primäres Anlageziel?",
    options: [
      { text: "Kapitalerhalt und regelmäßige Dividenden", score: 1 },
      { text: "Balance zwischen Wachstum und Einkommen", score: 2 },
      { text: "Maximales Wachstum, Dividenden sind zweitrangig", score: 3 },
    ],
  },
  {
    id: 4,
    question: "Wie viel Erfahrung haben Sie mit Aktieninvestitionen?",
    options: [
      { text: "Keine oder sehr wenig", score: 1 },
      { text: "Einige Jahre Erfahrung", score: 2 },
      { text: "Langjährige Erfahrung", score: 3 },
    ],
  },
  {
    id: 5,
    question: "Welche Schwankungen können Sie tolerieren?",
    options: [
      { text: "Maximal ±5% pro Jahr", score: 1 },
      { text: "±10-15% pro Jahr", score: 2 },
      { text: "±20% oder mehr pro Jahr", score: 3 },
    ],
  },
];

export default function InvestorTypeTest({ isOpen, onClose, onResult }: InvestorTypeTestProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const handleAnswer = (score: number) => {
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate result
      const totalScore = newAnswers.reduce((sum, s) => sum + s, 0);
      const avgScore = totalScore / newAnswers.length;

      let investorType: "conservative" | "balanced" | "dynamic";
      if (avgScore <= 1.6) {
        investorType = "conservative";
      } else if (avgScore <= 2.3) {
        investorType = "balanced";
      } else {
        investorType = "dynamic";
      }

      onResult(investorType);
      handleClose();
    }
  };

  const handleClose = () => {
    setCurrentQuestion(0);
    setAnswers([]);
    onClose();
  };

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white text-2xl">
            Anlegertyp-Test
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-400">
              <span>Frage {currentQuestion + 1} von {questions.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <Card className="bg-slate-700/50 border-slate-600 p-6">
            <h3 className="text-xl font-semibold text-white mb-6">
              {question.question}
            </h3>

            <div className="space-y-3">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(option.score)}
                  className="w-full text-left p-4 rounded-lg border-2 border-slate-600 bg-slate-800 hover:border-cyan-500 hover:bg-slate-700 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-slate-500 flex items-center justify-center text-slate-400 font-semibold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-white">{option.text}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Back button */}
          {currentQuestion > 0 && (
            <Button
              onClick={() => {
                setCurrentQuestion(currentQuestion - 1);
                setAnswers(answers.slice(0, -1));
              }}
              variant="outline"
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
            >
              Zurück
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

