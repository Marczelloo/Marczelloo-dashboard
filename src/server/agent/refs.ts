const PREFIX = "agent:";
const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Stored in deploys.logs_object_key so existing UI can follow agent jobs. */
export function agentLogRef(jobId: string): string {
  return `${PREFIX}${jobId}`;
}

export function parseAgentLogRef(value: string): string | null {
  if (!value.startsWith(PREFIX)) return null;
  const jobId = value.slice(PREFIX.length);
  return JOB_ID.test(jobId) ? jobId : null;
}
