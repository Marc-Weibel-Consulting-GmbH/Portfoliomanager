import { ChevronRight } from "lucide-react";

interface BreadcrumbStep {
  id: number;
  title: string;
  active: boolean;
  completed: boolean;
}

interface BreadcrumbNavProps {
  steps: BreadcrumbStep[];
  currentStep: number;
}

export default function BreadcrumbNav({ steps, currentStep }: BreadcrumbNavProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            step.active 
              ? 'bg-cyan-500/20 text-cyan-400' 
              : step.completed 
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-700/50 text-gray-500'
          }`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold ${
              step.active 
                ? 'bg-cyan-500 text-white' 
                : step.completed 
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-600 text-gray-400'
            }`}>
              {step.completed ? '✓' : step.id}
            </div>
            <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
          </div>
          {index < steps.length - 1 && (
            <ChevronRight className="w-5 h-5 text-gray-600 mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}
