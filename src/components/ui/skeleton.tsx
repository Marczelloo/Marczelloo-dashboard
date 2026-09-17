import { cn } from "@/lib/utils";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };
