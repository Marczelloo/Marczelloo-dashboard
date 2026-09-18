import { ServiceDetail } from "@/app/(dashboard)/services/_components/service-detail";

export default async function ProjectServicePage({ params }: { params: Promise<{ id: string; serviceId: string }> }) {
  const { id, serviceId } = await params;
  return <ServiceDetail serviceId={serviceId} backHref={`/projects/${id}`} backLabel="Back to project" />;
}
