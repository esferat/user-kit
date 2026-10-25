import {ProtectedAppShell} from "@/widgets/app-shell/ui/ProtectedAppShell";

export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return (
    <ProtectedAppShell>{children}</ProtectedAppShell>
  );
}
