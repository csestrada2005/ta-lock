export async function fetchTenantConfig(_tenantId: string): Promise<never> {
  throw new Error(
    "fetchTenantConfig from mockApi has been removed. Use the tenant-config Edge Function directly."
  );
}
