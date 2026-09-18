import { ServiceDetail } from "../_components/service-detail";

export default async function StandaloneServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ServiceDetail serviceId={id} backHref="/services" backLabel="Back to services" />;
}
