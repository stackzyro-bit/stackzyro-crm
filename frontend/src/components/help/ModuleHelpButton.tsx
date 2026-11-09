import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { HelpDrawer } from "./HelpDrawer";

interface ModuleHelpButtonProps {
  moduleKey: string;
  label?: string;
  variant?: "outline" | "ghost" | "secondary";
  size?: "sm" | "md";
}

export function ModuleHelpButton({
  moduleKey,
  label = "Guide",
  variant = "outline",
  size = "sm",
}: ModuleHelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        leftIcon={<HelpCircle className="h-3.5 w-3.5 text-brand-600" />}
        onClick={() => setOpen(true)}
        title={`Open ${label} for this module`}
      >
        {label}
      </Button>

      <HelpDrawer open={open} onClose={() => setOpen(false)} moduleKey={moduleKey} />
    </>
  );
}
