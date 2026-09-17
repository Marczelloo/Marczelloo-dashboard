import { PageHeader } from "./page-header";

interface HeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

/** Legacy page header API; new pages use PageHeader directly. */
export function Header({ title, description, children }: HeaderProps) {
  return <PageHeader title={title} description={description} actions={children} />;
}
