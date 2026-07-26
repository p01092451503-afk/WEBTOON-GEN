-- tenants: 자기 소속 테넌트만 조회
create policy "own tenant" on public.tenants
  for select using (id = public.current_tenant_id());

-- current_tenant_id: 익명 실행 차단
revoke execute on function public.current_tenant_id() from public, anon;
grant execute on function public.current_tenant_id() to authenticated;