import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--teal)] text-white hover:bg-[var(--teal-deep)] shadow-sm",
        secondary:
          "bg-[var(--stone)] text-[var(--ink)] hover:bg-[var(--stone-deep)]",
        outline:
          "border border-[var(--line)] bg-white/70 text-[var(--ink)] hover:bg-white",
        ghost: "text-[var(--ink)] hover:bg-black/5",
        danger: "bg-[var(--critical)] text-white hover:opacity-90",
        urgent: "bg-[var(--urgent)] text-white hover:opacity-90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-md px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
