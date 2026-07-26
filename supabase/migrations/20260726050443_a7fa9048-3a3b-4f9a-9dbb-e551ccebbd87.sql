ALTER PUBLICATION supabase_realtime ADD TABLE public.generations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_results;
ALTER TABLE public.generations REPLICA IDENTITY FULL;
ALTER TABLE public.generation_results REPLICA IDENTITY FULL;