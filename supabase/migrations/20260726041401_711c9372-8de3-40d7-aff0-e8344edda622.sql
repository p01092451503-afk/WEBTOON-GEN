
-- Character refs: tenant-isolated by first folder segment
create policy "tenant read refs" on storage.objects for select to authenticated using (
  bucket_id = 'character-refs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
create policy "tenant write refs" on storage.objects for insert to authenticated with check (
  bucket_id = 'character-refs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
create policy "tenant update refs" on storage.objects for update to authenticated using (
  bucket_id = 'character-refs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
) with check (
  bucket_id = 'character-refs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
create policy "tenant delete refs" on storage.objects for delete to authenticated using (
  bucket_id = 'character-refs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

-- Generation outputs: tenant-isolated by first folder segment
create policy "tenant read outputs" on storage.objects for select to authenticated using (
  bucket_id = 'generation-outputs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
create policy "tenant write outputs" on storage.objects for insert to authenticated with check (
  bucket_id = 'generation-outputs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
create policy "tenant update outputs" on storage.objects for update to authenticated using (
  bucket_id = 'generation-outputs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
) with check (
  bucket_id = 'generation-outputs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
create policy "tenant delete outputs" on storage.objects for delete to authenticated using (
  bucket_id = 'generation-outputs'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);
