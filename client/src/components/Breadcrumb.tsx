import { ChevronRight, Home } from "lucide-react";
import { Link } from "wouter";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-4">
      <Link href="/">
        <a className="flex items-center hover:text-foreground transition-colors">
          <Home className="h-4 w-4" />
        </a>
      </Link>
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-1">
          <ChevronRight className="h-4 w-4" />
          {item.href ? (
            <Link href={item.href}>
              <a className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                {item.icon}
                <span>{item.label}</span>
              </a>
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 text-foreground font-medium">
              {item.icon}
              <span>{item.label}</span>
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
