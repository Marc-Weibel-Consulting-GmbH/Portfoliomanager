import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * U-08: Einheitlicher Bestätigungsdialog für destruktive Aktionen.
 * Ersetzt die verstreuten Browser-`confirm()`-Aufrufe durch das
 * AlertDialog-Muster (wie PortfolioDetailsPage/Portfolios-Bulk-Delete).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Löschen",
  pendingLabel,
  onConfirm,
  isPending = false,
  confirmVariant = 'destructive',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  confirmVariant?: 'destructive' | 'default';
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-[#1a1f2e] border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="bg-transparent border-white/20 text-white hover:bg-white/10"
            disabled={isPending}
          >
            Abbrechen
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={confirmVariant === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-70' : 'bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-70'}
            disabled={isPending}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {pendingLabel ?? 'Wird ausgeführt…'}
              </span>
            ) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
