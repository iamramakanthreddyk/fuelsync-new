import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Deprecated DailyClosure page.
 *
 * This component exists only to redirect legacy `/daily-closure` routes
 * to the new `/settlements` page. Consumers should migrate to
 * `Settlements.tsx` and stop importing this module.
 */
export default function DailyClosure() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/settlements', { replace: true });
  }, [navigate]);

  return null;
}
