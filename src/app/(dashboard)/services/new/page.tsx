import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AddService } from "../_components/add-service";

export const metadata = { title: "Add service" };

export default function NewStandaloneServicePage() {
  return (
    <>
      <PageHeader
        title="Add standalone service"
        description="A service that belongs to no project, such as Portainer"
        actions={
          <Button variant="ghost" asChild>
            <Link href="/services">
              <ArrowLeft strokeWidth={1.75} />
              Back to services
            </Link>
          </Button>
        }
      />
      <PageBody>
        <AddService projectId={null} />
      </PageBody>
    </>
  );
}
