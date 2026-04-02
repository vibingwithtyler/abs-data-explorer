import { useState, useEffect } from 'react';

export default function useABSData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    fetch('/data/abs-challenges.json')
      .then(r => {
        if (!r.ok) throw new Error('No data file');
        return r.json();
      })
      .then(d => {
        setData(d);
        setIsDemo(false);
      })
      .catch(() => {
        import('../data/fallback.js').then(m => {
          setData(m.default);
          setIsDemo(true);
        }).catch(e => setError(e.message));
      })
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error, isDemo };
}
