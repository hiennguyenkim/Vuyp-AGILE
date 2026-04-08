-- ============================================================
-- Sync events.registered from registrations
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_event_registered_count()
RETURNS TRIGGER AS $$
DECLARE
  target_event_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_event_id := OLD.event_id;
  ELSE
    target_event_id := NEW.event_id;
  END IF;

  UPDATE public.events
  SET registered = (
    SELECT COUNT(*)
    FROM public.registrations
    WHERE event_id = target_event_id
  ),
  updated_at = NOW()
  WHERE id = target_event_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS registrations_sync_count ON public.registrations;
CREATE TRIGGER registrations_sync_count
  AFTER INSERT OR DELETE ON public.registrations
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_registered_count();
